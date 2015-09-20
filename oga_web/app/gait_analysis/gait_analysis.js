'use strict';
angular.module('oga_web.gait_analysis', ["ngFileUpload", "ngRoute", "ngMaterial", "ngMdIcons", "oga_web.oga_facade"])
.config(['$routeProvider', function($routeProvider) {
	$routeProvider
	.when("/gait_analysis/patient/:id", {
		templateUrl: "gait_analysis/gait_analysis.html",
		controller: "gaitAnalysisCtrl", 
		resolve: {
			patient: function(patientsFacade, $route) {
				var id = $route.current.params.id;
				return patientsFacade.getPatient(id);
			}
		}
	});
}])
.controller('gaitAnalysisCtrl', function (
	$rootScope, 
	$scope, 
	$location, 
	$sce,
	patient, 
	Upload,
	$timeout, 
	$mdSidenav, 
	$mdUtil, 
	$mdToast,
	$log,
        $mdDialog,	
	urlApi,
	patientsFacade,
	positionalsDataFacade){
	$scope.patient = patient.data;
	$scope.isAdding = false;
	$scope.isAddingNewAngle = false;
	$scope.isShowMarkers = false;
	$scope.isShowAngles = false;
	$scope.isShowPlot = false;
	$scope.gaitSampleEnabled = false;
	$scope.gait_sample = null;
	$scope.isPlaySample = false;
	$scope.loading = true;
	$scope.positionalsData = null;

	$scope.addNewAngle = addNewAngle;
	$scope.back = back;
	$scope.deleteAngle = deleteAngle;
	$scope.formatMarkerName =   formatMarkerName ;
	$scope.plotAngle = plotAngle;
	$scope.plotAngularVelocities = plotAngularVelocities;
	$scope.showGraphic = showGraphic;
	$scope.showGaitSample = showGaitSample;
	$scope.upload = upload; 
	$scope.addGaitData = addGaitData;
	$scope.setFile = setFile;
	$scope.cancel = cancel;
	$scope.confirmDeletion = confirmDeletion;
	$scope.playGaitSample = playGaitSample;
	$scope.saveSample = saveSample;
	$scope.showMarkers = showMarkers;
	$scope.showAngles = showAngles;
	$scope.goBack = goBack;

	$scope.$on('cancelAddNewAngle', function(event) {
		$scope.isAddingNewAngle = false;
	});

	$scope.$on('saveNewAngle', function(event) {
		if (!$scope.positionalsData.angles) {
			$scope.positionalsData.angles=[];
		}
		$scope.angle.origin = parseInt($scope.angle.origin);
		$scope.angle.component_a = parseInt($scope.angle.component_a);
		$scope.angle.component_b = parseInt($scope.angle.component_b);
		$scope.positionalsData.angles.push($scope.angle);
		$scope.isAddingNewAngle = false;
		$scope.saveSample();
	});

	$scope.$watch('isPlaySample', function (newValue, oldValue) {
		if (!newValue && !$scope.loading) {
			$location.path('/gait_analysis/patient/' + $scope.patient._id.$oid + '/');
		}
		$scope.loading = false;
	});

	if ($scope.gait_sample == null){
		if ($scope.patient.gait_samples && $scope.patient.gait_samples.length > 0){
			$scope.showGaitSample($scope.patient.gait_samples[0]);
		}
	}
	else {
		$scope.showGaitSample($scope.gait_sample);
	}

	function addNewAngle() {
		$scope.angle = {};
		$scope.isAddingNewAngle = true;
	}

	function back() {
		$scope.isShowPlot = false;
	}
	
	function confirmDeletion(ev) {
		// Appending dialog to document.body to cover sidenav in docs app
		var confirm = $mdDialog.confirm()
		.title('Would you like to delete gait sample ' + $scope.gait_sample.description + '?')
		.content('')
		.ariaLabel('Gait Sample Deletion')
		.ok('Ok')
		.cancel('Cancel')
		.targetEvent(ev);
		$mdDialog.show(confirm).then(function() {
			positionalsDataFacade.deletePositionalsData($scope.positionalsData._id.$oid).success(function(data, status, headers, config) {	
				$location.path('/gait_analysis/patient/' + $scope.patient._id.$oid + '/');
				make_toast('Deleted');
			})
			.error(function (data, status, headers, config){
				make_toast('Deletion failed');
			});
		}, function() {
			make_toast('Canceled');
		});
	};

	function deleteAngle(ev, angle_index) {
		// Appending dialog to document.body to cover sidenav in docs app
		var confirm = $mdDialog.confirm()
		.title('Would you like to delete  the angle' + $scope.positionalsData.angles[angle_index].description + '?')
		.content('')
		.ariaLabel('Angle Deletion')
		.ok('Ok')
		.cancel('Cancel')
		.targetEvent(ev);
		$mdDialog.show(confirm).then(function() {
			$scope.positionalsData.angles.splice(angle_index, 1);
			$scope.saveSample();

		}, function() {
			make_toast('Canceled');
		});

	};
	function formatMarkerName(marker_index) {
		var desc = ""
		var marker = $scope.positionalsData.markers[marker_index];
		if (marker == "") {
			desc = "Marker " + marker_index;
		} else {
			desc = marker;
		}

		return desc;
	}

	function playGaitSample() {
		positionalsDataFacade.getTrajectories($scope.positionalsData._id.$oid).success(function(data, status, headers, config) {
			$scope.isPlaySample = true;
			init(data, $scope.positionalsData.frames, $scope.positionalsData.frame_rate);
		}).error(function(data, status, headers, config) {
			make_toast('Trajectories not found');
		});

		function init(data, frames, frameRate) {

			var padding = 0;
			var content = document.getElementById("md-content-gait-sample-detail");
			var canvas = document.getElementById("webgl_output");
			var scene = new THREE.Scene();
			var camera = new THREE.PerspectiveCamera(45, (content.clientWidth - padding) / (content.clientHeight - padding), 0.1, 10000); 
			var renderer = new THREE. WebGLRenderer();
			var sphereGeometry = new THREE.SphereGeometry(20, 20, 20);
			var sphereMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
			var trackballControls = new THREE.TrackballControls(camera, content);
			var clock = new THREE.Clock();
			var animationId = null;
			var spheres = [];
			var frame = 0;
			var axes = new THREE.AxisHelper(5000);
			scene.add(axes);

			camera.position.x = 4000;
			camera.position.y = 4000;
			camera.position.z = 4000;
			camera.lookAt(scene.position);

			renderer.setClearColor(0x000000);
			renderer.setSize(content.clientWidth, content.clientHeight);

			for (var i =0; i < data.length; i++) {
				var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
				spheres.push(sphere);
				scene.add(sphere);
			}

			trackballControls.rotateSpeed = 0.5;
			trackballControls.zoomSpeed = 0.5;
			trackballControls.panSpeed = 0.5;

			canvas.appendChild(renderer.domElement);

			window.removeEventListener('resize', onResize);
			window.addEventListener('resize', onResize, false);
			window.addEventListener('mousedown', onMouseMove,false );
			var raycaster = new THREE.Raycaster();
			var mouse = new THREE.Vector2();
			function onMouseMove(event) {
				mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
				mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;	
				// update the picking ray with the camera and mouse position	
				raycaster.setFromCamera( mouse, camera );	

				// calculate objects intersecting the picking ray
				var intersects = raycaster.intersectObjects(spheres);

				for ( var i = 0; i < intersects.length; i++ ) {

					intersects[ i ].object.material.color.set( 0x0000ff );
	
				}

				renderer.render( scene, camera );	

			}

			var pause = false;
			var controls = new function() {
				this.frameSpeed = 1;
				this.play =  function () {pause = false; };
				this.pause=  function () {pause = true; };
				this.frames = 0;
			}
			var gui = new dat.GUI();
			gui.add(controls, 'frameSpeed', 0, 3);
			gui.add(controls, 'pause');
			gui.add(controls, 'play');
			gui.add(controls, 'frames', 0, $scope.positionalsData.frames).listen();
			var last_frame = 0
			function update_frames() {
				requestAnimationFrame(update_frames);
				if (controls)
					controls.frames = last_frame;
			}

			render();

			function onResize() {
				if ($scope.isPlaySample) {
					var width = content.clientWidth - padding;
					var height = content.clientHeight - padding;
					camera.aspect = width / height;
					camera.updateProjectionMatrix();
					renderer.setSize(width, height);
					renderer.render(scene, camera);	
				}
			};

			var time = 0;
			function render() {
				if ($scope.isPlaySample) {
					

					var delta = clock.getDelta();
					trackballControls.update(delta);
					for (var i =0; i < data.length; i++) {
						var x = data[i][0][frame];
						var y = data[i][1][frame];
						var z = data[i][2][frame];

						if ( x == 0 || y == 0 || z == 0) {
							spheres[i].visible = false;
						} else {
							spheres[i].position.x = x; 
							spheres[i].position.y = z;
							spheres[i].position.z = y;
							spheres[i].visible = true;
						}
					}		
					if (!pause) {
						var tprime = (1/frameRate) * (1/controls.frameSpeed);	
						time = time + delta;			
						frame = Math.round(time / tprime);

						if (frame > frames) {
							frame = 0;
							time = 0;
						} 
						last_frame = frame;
						update_frames()
					}
					animationId = requestAnimationFrame(render);
					renderer.render(scene, camera);
				} else {
					window.removeEventListener('resize', onResize);
					if (animationId) 
						window.cancelAnimationFrame(animationId);
					while(canvas.hasChildNodes())
						canvas.removeChild(canvas.childNodes[0]);
					padding = null;
					content = null;
					canvas = null;
					scene = null;
					camera = null;
					renderer = null;
					sphereGeometry = null;
					sphereMaterial = null;
					spheres = [];
					trackballControls = null;
					clock = null;
					animationId = null;
					frame = 0;
					axes = null;
					dat.GUI.toggleHide();
					gui = null;
					controls = null;
				}
				
			};
		}
	}

	function plotAngle(ev, angle_index) {
		positionalsDataFacade.plotAngles($scope.positionalsData._id.$oid, angle_index).success(function (data, status, headers, config) {
			$scope.isShowPlot = true;
			var iframe = document.getElementById('plotIframe');
			var doc = iframe.contentWindow.document;
			doc.open();
			doc.write(data);
			doc.close();
		}).error(function(data, status, headers, config){
				console.log('Error: ' + status);
		});
	};
	function plotAngularVelocities(ev, angle_index) {
		positionalsDataFacade.plotAngularVelocities($scope.positionalsData._id.$oid, angle_index).success(function (data, status, headers, config) {
			$scope.isShowPlot = true;
			var iframe = document.getElementById('plotIframe');
			var doc = iframe.contentWindow.document;
			doc.open();
			doc.write(data);
			doc.close();
		}).error(function(data, status, headers, config){
				console.log('Error: ' + status);
		});
	};


	function showGraphic (selected_marker) {
		positionalsDataFacade.plotMarker($scope.positionalsData._id.$oid, selected_marker).success(function (data, status, headers, config) {
			$scope.isShowPlot = true;
			var iframe = document.getElementById('plotIframe');
			var doc = iframe.contentWindow.document;
			doc.open();
			doc.write(data);
			doc.close();
		}).error(function(data, status, headers, config){
				console.log('Error: ' + status);
		});
	}

	function showGaitSample(gait_sample) {
		if (gait_sample.date) {
			var date = new Date(gait_sample.date);
			gait_sample.date = date;
		}
		$scope.gait_sample = gait_sample;
		$scope.gaitSampleEnabled = true;
		$scope.isAdding = false;
		var sample_index = $scope.patient.gait_samples.indexOf($scope.gait_sample);
		positionalsDataFacade.getPositionalsData($scope.patient._id.$oid, sample_index).success(function(data, status, headers, config){
			$scope.positionalsData = data;			
		}).error(function(data, status, headers, config){
			$scope.positionalsData = null;
		});
		$scope.isShowMarkers = false;
		$scope.isShowAngles = false;
		$scope.isAddingNewAngle = false;
		$scope.isPlaySample = false;
		$scope.isShowPlot = false;
	}

	function upload (files){
		if (files && files.length) {
			var file = files[0];
			Upload.upload({
				url: urlApi.urlString() + 'gait_sample/upload/' + $scope.patient._id.$oid + '/'+ $scope.patient.gait_samples.indexOf($scope.gait_sample) + '/',
				fields: {'username': 'teting'},
				file: file
			}).progress(function (evt){
				var progressPercentage = parseInt(100.0 * evt.loaded / evt.total);
				console.log('progress: ' + progressPercentage + '% ' + evt.config.file.name);
			}).success(function(data, status, headers, config){
				$scope.positionalsData = data;
				console.log('file ' + config.file.name + 'uploaded.');
			}).error(function(data, status, headers, config){
				console.log('Error: ' + status);
			});
		}
	};

	function addGaitData() {
		var newDate = new Date();
		newDate =new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
		$scope.gait_sample = {date:newDate, description:null};
		$scope.positionalsData = null;
		$scope.isAdding = true;
		$scope.gaitSampleEnabled = false;
		$scope.isShowMarkers = false;
		$scope.isShowAngles = false;
		$scope.isPlaySample = false;
	};
	function setFile(element) {
		$scope.currentFile = element.files[0];
	};
	function cancel() {
		$location.path('/gait_analysis/patient/' + $scope.patient._id.$oid + '/');
	}
	function goBack() {
		$location.path('/patients');
	}
	function saveSample(){
		if (!$scope.gait_sample.description) {
			make_toast("Inform description");
			return;
		}
		if (!$scope.gait_sample.date) {
			make_toast("Inform the date");
			return;
		}

		if ($scope.isAdding) {
			if (typeof($scope.patient.gait_samples) === 'undefined')
				$scope.patient.gait_samples = [];
			$scope.patient.gait_samples.push($scope.gait_sample);
		}
		patientsFacade.updatePatient($scope.patient).success(function (data, status, headers, config) {
			if (!$scope.isAdding) {
				if (typeof($scope.positionalsData.initial_frame) === 'undefined' || $scope.positionalsData.initial_frame < 0) {
					make_toast('Initial contact invalid. Must be greater than or equal 0');
					return;
				}
				if (typeof($scope.positionalsData.final_frame) === 'undefined' || $scope.positionalsData.final_frame >= $scope.positionalsData.frames) {
					make_toast('Terminal swing invalid. Must be less than frames');
					return;
				}
				if ($scope.positionalsData.initial_frame >= $scope.positionalsData.final_frame){
					make_toast('Initial contantct must be less than final swing');
					return;
				}
				positionalsDataFacade.updatePositionalsData($scope.positionalsData).success(function(data, status, headers, config){
					var isShowMarkers = $scope.isShowMarkers;
					var isShowAngles = $scope.isShowAngles;
					$scope.showGaitSample($scope.gait_sample);
					$scope.isShowMarkers = isShowMarkers;	
					$scope.isShowAngles = isShowAngles;	
					make_toast('Saved');
				})
				.error(function(data, status, headers, config){
					make_toast('Failed');
				});
			}
			else {
				$scope.isAdding = false;
				$scope.showGaitSample($scope.gait_sample);
				make_toast('Saved');
			}
			//$location.path('/gait_analysis/patient/' + $scope.patient._id.$oid  + '/');
		})
		.error(function(data, status, headers, config) {
			$scope.patient.gait_samples.pop();
			alert('Error: '+status + ' Data: ' + angular.fromJson(data));
		});
	};
	function showMarkers() {
		$scope.isShowMarkers = !$scope.isShowMarkers;
		$scope.isShowAngles = false;
	}	
	function showAngles() {
		$scope.isShowAngles = !$scope.isShowAngles;
		$scope.isShowMarkers = false;
	}	
	
	$scope.toggleLeft = buildToggler('left');

	/**
	* Build handler to open/close a SideNav; when animation finishes
	* report completion in console
	*/
	function buildToggler(navID) {
		var debounceFn =  $mdUtil.debounce(function(){
			$mdSidenav(navID)
			.toggle()
			.then(function () {
				//$log.debug("toggle " + navID + " is done");
			});
		},300);
		return debounceFn;
	}
	$scope.close = function () {
		$mdSidenav('left').close()
		.then(function () {
			//$log.debug("close LEFT is done");
		});
	};
	function make_toast(str) {
		$mdToast.show(
			$mdToast.simple()
			.content(str)
			.position('bottom right')
			.hideDelay(3000)
		);
	};
}).controller('gaitAnalysisAddNewAngleCtrl', function (
	$scope) {

	$scope.cancelNewAngle = cancelNewAngle;
	$scope.saveNewAngle = saveNewAngle;

	function saveNewAngle() {
		$scope.$emit('saveNewAngle');
	}

	function cancelNewAngle() {
		$scope.$emit('cancelAddNewAngle');
	}
});
