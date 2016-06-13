//todo: create local scopes so don't need to use val anymore

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
	$scope.acc_lists = {
		admin_groups: ["infrastructure_sg", "support_sg", "networking_sg"],
		env_tag: ["prod", "dev"],
		allowed_groups: ["infrastructure_sg", "support_sg", "networking_sg"],
		allowed_users: ["splunksvc"],
		roles: ["admin", "nadmin"],
		role : ["admin", "nadmin"]
	};
	$scope.existing_lists ={};

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
					$scope.id = id;
					for(var item in assets.pillars[i]){
						if (item === "minion" || item === "_id"){
							continue;
						}
						pillar_container[item] = assets.pillars[i][item] || "N/A";
					}
					assets.getPillar(pillar_container);
				    for (var k in pillar_container) {
    					if (pillar_container.hasOwnProperty(k)) {
    						$scope.existing_lists[k] = pillar_container[k];					}
					}
					$scope.envCheck(pillar_container);
				}
			}
			for (var k in assets.this_pillar[0]){
				if (assets.this_pillar[0][k].constructor === Array){
					for(var nested in assets.this_pillar[0][k]){
						if ($scope.acc_lists[k].indexOf(assets.this_pillar[0][k][nested])>=0){
							$scope.acc_lists[k].splice($scope.acc_lists[k].indexOf(assets.this_pillar[0][k][nested]), 1);
						}
					}
				}
			}
			reset_vals = JSON.stringify($scope.existing_lists);
		});
	}

	$scope.accessJobs = function(){
		assets.this_job = [];
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
		$scope.value = Object.keys(obj)[0];
		$scope.limit = 0;
	}

	$scope.grabModalVals = function(key, val) {
		if (JSON.stringify($scope.existing_lists) === reset_vals){
			$scope.message = "Please modify values to be saved first";
			$scope.data = "";
			$scope.disabled = true;
		} else {
			$scope.message = "Please confirm that below is correct:";
			$scope.data = $scope.existing_lists;
			$scope.enabled = true;
			$scope.disabled = false;
		}
	}

	$scope.updateVal = function(key, val, index, value, addFlag, removeFlag){
		if (addFlag === true) {
			if (value!= undefined && $scope.limit < 1 && $scope.existing_lists[key].indexOf(value)<0){
				$scope.existing_lists[key].push(value);
				$scope.acc_lists[key].splice($scope.acc_lists[key].indexOf(value), 1);
				$scope.limit ++;
			}
		} else if (removeFlag === true) {
			if (index!= undefined && $scope.limit < 1){
				$scope.existing_lists[key].splice(index, 1);
				if ($scope.acc_lists[key].indexOf(value)<0){
					$scope.acc_lists[key].push(value);
					$scope.limit ++;
				}
			}
		} else {
			if($scope.value!=undefined){
				$scope.existing_lists[key] = $scope.value;
				$scope.value = undefined;
			}
		}
		$scope.updated_host = $scope.id;
		$scope.updated_val = angular.toJson($scope.existing_lists);
	}

	$scope.saveChanges = function() {
		if($scope.updated_host != undefined) {
	        $http({
	          method  : 'POST',
	          url     : '/api/pillars/',
	          data    : $.param({
	        	host: $scope.updated_host,
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

	$scope.reset = function () {
		$scope.existing_lists = JSON.parse(reset_vals);
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
