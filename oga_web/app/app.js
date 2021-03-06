'use strict';

// Declare app level module which depends on views, and components
angular.module('oga_web', [
	'ngRoute',
	"ngMaterial", 
	"ngMdIcons", 
	'oga_web.gait_analysis', 
	'oga_web.menu',
	'oga_web.patients',
	'oga_web.patient',
	'oga_web.simulations',
	'oga_web.oga_facade',
	'myApp.version',
])
.config(['$routeProvider', function($routeProvider) {
	$routeProvider.otherwise({redirectTo: '/menu'});
}])
.run(function($rootScope) {
	$rootScope.apptitle = 'Open Gait Analytics';
});
