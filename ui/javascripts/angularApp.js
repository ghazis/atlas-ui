var get_counter = 0;
var assetsApp = angular.module('assetsApp', ['ui.router']);
assetsApp.config([
'$stateProvider',
'$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {

	$stateProvider
	  .state('home', {
	  url: '/home',
	  templateUrl: '/home.ejs',
	  controller: 'MainCtrl'
	  })

	$stateProvider
	  .state('asset', {
	  url: '/asset?id',
	  templateUrl: '/asset.ejs',
	  controller: 'MainCtrl',
	  })

	$stateProvider
	  .state('jobs', {
	  url: '/jobs?id',
	  templateUrl: '/jobs.ejs',
	  controller: 'MainCtrl',
	  })

	$urlRouterProvider.otherwise('home');

}])
assetsApp.factory('assets', function(){
	var assets = {
        assets: [],
        pillars: [],
        this_asset: [],
        this_pillar: [],
        this_job: [],
        ilo_ips: [],
    };

    assets.getAssets = function(asset){
    	assets.assets.push(asset);
    }
    assets.getPillars = function(pillar){
    	assets.pillars.push(pillar);
    }

    assets.getAsset = function(asset) {
    	if (assets.this_asset.length === 0){
    		assets.this_asset.push(asset);
    	}
    }

    assets.getPillar = function(pillar) {
    	if (assets.this_pillar.length === 0){
    		assets.this_pillar.push(pillar);
    	}
    }

    assets.getJob = function(job) {
    	assets.this_job.push(job);
    }

    return assets;
})

assetsApp.controller('MainCtrl', [
'$scope',
'assets',
'$http',
'$window',
'$location',
function($scope, assets, $http, $window, $location) {
	$scope.sortType = 'host';
	$scope.sortReverse = false;
	$scope.search = '';
	$scope.assets = assets.assets;
	$scope.this_id = $location.search()['id'];

	$scope.checkType = function(item) {
		if(item === undefined){
			item = "N/A";
		}
	    if (item.constructor === Object){
	   		return "dict";
		} else if (item.constructor === Array){
	   		return "arr";
		} else if (item.constructor === String || item.constructor === Number || item.constructor === Boolean) {
			return "str";
		} else {
			return "undefined";
		}
	};

	$scope.accessAsset = function(id){
		assets.this_asset = [];
		assets.this_pillar = [];
		id = $location.search()['id']
    	$http.get('/api/assets/' + id).then(function(data) {
    		var data = data.data;
			var asset_container = {};
			for(var item in data){
				asset_container[item] = data[item] || "N/A";
				if ($scope.checkType(asset_container[item]) === 'arr'){
					if(asset_container[item].length === 1 && $scope.checkType(asset_container[item][0]) !== 'dict' && $scope.checkType(asset_container[item][0]) !== 'arr'){
						asset_container[item] = asset_container[item][0];
					}
					if(asset_container[item].length === 0){
						asset_container[item] = "N/A";
					}
				}
			}
			assets.getAsset(asset_container);


			asset = asset_container;
			var pillar_container = {};
			for (var i=0;i<assets.pillars.length;i++){
				var id = assets.pillars[i]['_id'];
				if (id === asset['host']){
					for(var item in assets.pillars[i]){
						if (item === "minion"){
							continue;
						}
						pillar_container[item] = assets.pillars[i][item] || "N/A";
					}
					assets.getPillar(pillar_container);
					$scope.envCheck(pillar_container);
				}
			}
		});
	}

	$scope.accessJobs = function(){
		id = $location.search()['id']
    	$http.get('/api/jobs/?id=' + id).then(function(data) {
    		var data = data.data;
			for (var i=0;i<data.length;i++){
				var job_container = {};
				for(var item in data[i]){
					job_container[item] = data[i][item] || "N/A";
				}
				for(var elem in job_container['full_ret']){
					if($scope.checkType(job_container['full_ret'][elem])==='dict'){
						var to_be_pretty = job_container['full_ret'][elem];
						pretty = JSON.stringify(to_be_pretty, null, 2);
						job_container['full_ret'][elem] = pretty;
					}
				}
				assets.getJob(job_container['full_ret']);
			}
		});
	}

	$scope.addAssets = function(id){
	    $http.get('/api/assets/').success(function(data) {
			for (var i=0;i<data.length;i++){
				var asset_container = {};
				for(var item in data[i]){
					asset_container[item] = data[i][item] || "N/A";
					if ($scope.checkType(asset_container[item]) === 'arr'){
						if(asset_container[item].length === 1 && $scope.checkType(asset_container[item][0]) !== 'dict' && $scope.checkType(asset_container[item][0]) !== 'arr'){
							asset_container[item] = asset_container[item][0];
						}
						if(asset_container[item].length === 0){
							asset_container[item] = "N/A";
						}
					}
				}
				assets.getAssets(
					asset_container
				)
			}
	    });
	};

	$scope.addEditableAssets = function(){
	    $http.get('/api/pillars/').success(function(data) {
	    	var count = 0;
			for(var item in data){
				var pillar_container = {};
				count+=1;
				for (var nested in data[item]){
					pillar_container[nested] = data[item][nested] || "N/A";
				}
				assets.getPillars(
					pillar_container
				)
			}
	    });
	};

	$scope.collectElems = function(item){
		obj = JSON.parse(item);
		$scope.index = obj[Object.keys(obj)[0]];
	}

	$scope.grabModalVals = function(key, val) {
		$scope.grabbed_key = key;
		$scope.grabbed_val = val;
	}

	$scope.updateVal = function(host, key, val, index, value, addFlag, removeFlag){
		if (addFlag === true) {
			if (value!= undefined){
				val.push(value);
			}
		} else if (removeFlag === true) {
			if (index!= undefined){
				val.splice(index, 1);
			}
		} else {
			val[index] = value;
		}
		if (val.constructor == Array) {
			val = angular.toJson(val);
		} else if (val.constructor == String) {
        	val = value;
        	assets.this_pillar[0][key] = val;
		}
		$scope.updated_host = host;
		$scope.updated_key = key;
		$scope.updated_val = val;
	}

	$scope.saveChanges = function() {
		if($scope.updated_host != undefined) {
	        $http({
	          method  : 'POST',
	          url     : '/api/pillars/',
	          data    : $.param({
	        	host: $scope.updated_host,
	        	key: $scope.updated_key,
	        	val: $scope.updated_val
	        }),
	          headers : {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'} 
	         })
	          .success(function(data) {
	          	// console.log("worked");
	          }).error(function(data){
	          	// console.log('did not work');
	          })
		}
	}

	$scope.envCheck = function(asset) {
		if (asset['env_tag'] == "prod"){
			$scope.envClass = "panel-danger";
			$scope.env = asset['env_tag'] + " - ";
		}
		$scope.env = asset['env_tag'] + " - ";
	}

	$scope.jobStatus = function(job){
		if(job['success']===true){
			return true;
		}
	}

	//ensures assets are not added to table multiple times by pressing back button
	if(get_counter === 0){
		$window.onload = $scope.addAssets();
		$window.onload = $scope.addEditableAssets();
		get_counter += 1;
	}


	if($scope.this_id){
		$scope.accessAsset($scope.this_id);
		$scope.accessJobs();
	}
	$scope.this_asset = assets.this_asset;
	$scope.this_pillar = assets.this_pillar;
	$scope.this_job = assets.jobs;
	$scope.this_job = assets.this_job;

}]);
