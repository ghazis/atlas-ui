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

	$stateProvider
	  .state('runs', {
	  url: '/runs?id',
	  templateUrl: '/runs.ejs',
	  controller: 'MainCtrl',
	  })

	$urlRouterProvider.otherwise('home');

}])

assetsApp.factory('assets', function(){
	var assets = {
        assets: [],
        pillars: [],
        runs: [],
        this_asset: [],
        this_pillar: [],
        this_job: [],
    };

    assets.getAssets = function(asset){
    	assets.assets.push(asset);
    }

    assets.getPillars = function(pillar){
    	assets.pillars.push(pillar);
    }

    assets.getRuns = function(run) {
    	assets.runs.push(run);
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
	$scope.list_index = [];
	$scope.modified_rows_index = [];
	$scope.this_id = $location.search()['id'];
	$scope.homepage_fields = ['host', 'roles', 'tags', 'env_tag', 'ipv4', 'ilo_ip', 'serialnumber', 'productname', 'osrelease', 'allowed_groups'];
	//possible values lists
	$scope.acc_lists = {
		admin_users: ["pkusch"],
		admin_groups: ["infrastructure_sg", "support_sg", "networking_sg", "kdb-users_sg", "risk_sg", "core-tech_sg", "core-dev_sg", "core-data_sg","rhone-developers_sg", "rhone-users_sg", "1729_sg", "armada_sg", "cdg_sg", "fxd_sg", "gamc_sg", "house_sg", "pmg_sg", "risk_sg", "team1_sg", "tmt_sg"],
		env_tag: ["prod", "dev"],
		allowed_groups: ["infrastructure_sg", "support_sg", "networking_sg", "kdb-users_sg", "risk_sg", "core-tech_sg", "core-dev_sg", "core-data_sg","rhone-developers_sg", "rhone-users_sg", "1729_sg", "armada_sg", "cdg_sg", "fxd_sg", "gamc_sg", "house_sg", "pmg_sg", "risk-sg", "team1_sg", "tmt_sg"],
		allowed_users: ["splunksvc", "pcapd", "rhouse", "coredevsvc", "scilasvc", "refdatasvc", "rhonemdssvc", "rhonesvc", "rhonemdsdevsvc", "ocapsvc", "atlassvc"],
		roles: ["admin", "dev", "mds", "nadmin", "kdb", "pcapd", "rhone"],
	};
	$scope.reset_acc_lists = JSON.stringify($scope.acc_lists);
	//empty object which will contain all current values that are pulled from http call
	$scope.existing_lists ={};

	$scope.show = function() {
		console.log($scope.sortType);
	}

	$scope.checkType = function(item) {
		if(item === undefined){
			item = "N/A";
			return "undefined";
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
				//making sure that pillar exists within assets
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
    						//inserting current values into object for comparision purposes
    						$scope.existing_lists[k] = pillar_container[k];					}
					}
					$scope.envCheck(pillar_container);
				}
			}
			for (var k in assets.this_pillar[0]){
				$scope.list_index.push(k);
				if (assets.this_pillar[0][k].constructor === Array){
					for(var nested in assets.this_pillar[0][k]){
						//removes any values from acc_lists if they exist in existing_lists
						try{
							if ($scope.acc_lists[k].indexOf(assets.this_pillar[0][k][nested])>=0){
								$scope.acc_lists[k].splice($scope.acc_lists[k].indexOf(assets.this_pillar[0][k][nested]), 1);
							}
						} catch(err) {
							continue;
						}
					}
				}
			}
			$scope.initial_vals = JSON.stringify($scope.existing_lists);
		});
	}

	$scope.accessRuns = function(){
		assets.runs = [];
		id = $location.search()['id']
    	$http.get('/api/runs/?id=' + id).then(function(data) {
    		var data = data.data;
			for (var i=0;i<data.length;i++){
				var runs_container = {};
				for(var item in data[i]){
					runs_container[item] = data[i][item] || "N/A";
				}
				for(var elem in runs_container['full_ret']){
					if($scope.checkType(runs_container['full_ret'][elem])==='dict'){
						var to_be_pretty = runs_container['full_ret'][elem];
						pretty = JSON.stringify(to_be_pretty, null, 2);
						runs_container['full_ret'][elem] = pretty;
					}
				}
				assets.getRuns(runs_container['full_ret']);
			}
		});
	}

	$scope.accessJobs = function(){
		assets.this_job = [];
		id = $location.search()['id']
    	$http.get('/api/jobs/?id=' + id).then(function(data) {
    		var data = data.data;
			for (var i=0;i<data.length;i++){
				var runs_container = {};
				for(var item in data[i]){
					runs_container[item] = data[i][item] || "N/A";
				}
				for(var elem in runs_container['full_ret']){
					if($scope.checkType(runs_container['full_ret'][elem])==='dict'){
						var to_be_pretty = runs_container['full_ret'][elem];
						pretty = JSON.stringify(to_be_pretty, null, 2);
						runs_container['full_ret'][elem] = pretty;
					}
				}
				assets.getJob(runs_container['full_ret']);
			}
		});
	}

	$scope.addAssets = function(id){
	    $http.get('/api/assets/').success(function(data) {
			for (var i=0;i<data.length;i++){
				var asset_container = {};
				for(var item in data[i]){
					asset_container[item] = data[i][item] || "N/A";
					//checks if array has one element. If it does then converts to string.
					if ($scope.checkType(asset_container[item]) === 'arr'){
						if(asset_container[item].length === 1 && $scope.checkType(asset_container[item][0]) !== 'dict' && $scope.checkType(asset_container[item][0]) !== 'arr'){
							asset_container[item] = asset_container[item][0];
						}
						//checks if array is empty and applies "N/A" if it is
						if(asset_container[item].length === 0){
							asset_container[item] = "N/A";
						}
					}
				}
				//sends to factory
				assets.getAssets(
					asset_container
				)
				if(asset_container['host']=='baslsa001'){
					console.log($scope.checkType(asset_container['ilo_ip']));
				}
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

	$scope.collectElems = function(item, removeFlag){
		//called whenever a value is clicked to grab information
		if(item != undefined){
			obj = JSON.parse(item);
			$scope.index = obj[Object.keys(obj)[0]];
			//console.log($scope.index);
			$scope.value = Object.keys(obj)[0].substr(0, Object.keys(obj)[0].indexOf(','));
			$scope.key = Object.keys(obj)[0].substr(Object.keys(obj)[0].indexOf(',')+1);
			$scope.limit = 0;
		}
		$scope.master_index = $scope.list_index.sort().indexOf($scope.key);
		//disables add/remove button depending on if clicked value is in acc_lists/existing_lists
		if(removeFlag===true){
		    document.getElementById("addBut"+$scope.master_index).disabled = true;
		    document.getElementById("remBut"+$scope.master_index).disabled = false;
		}
		if(removeFlag===false){
			document.getElementById("remBut"+$scope.master_index).disabled = true;
			document.getElementById("addBut"+$scope.master_index).disabled = false;
		}
	}

	$scope.grabModalVals = function(key, val) {
		//changes modal message if values are modified or not
		if (JSON.stringify($scope.existing_lists) === $scope.initial_vals){
			$scope.message = "Please modify values to be saved first";
			$scope.data = "";
			$scope.disabled = true;
		} else {
			$scope.message = "Please confirm that below is correct:";
			$scope.existing_lists.role = $scope.existing_lists.roles
			$scope.data = $scope.existing_lists;
			$scope.enabled = true;
			$scope.disabled = false;
		}
	}

	$scope.updateVal = function(key, val, index, value, addFlag, removeFlag){
		$scope.save_status = false;
		$scope.row_index = $scope.list_index.sort().indexOf(key);
		if (addFlag === true) {
			$('#add option').attr('selected', null);
			document.getElementById("rem").disabled = false;
			if (value!= undefined && $scope.limit < 1 && $scope.existing_lists[key].indexOf(value)<0){
				$scope.existing_lists[key].push(value);
				$scope.acc_lists[key].splice($scope.acc_lists[key].indexOf(value), 1);
				$scope.limit ++;
			}
		} else if (removeFlag === true) {
			$('#rem option').attr('selected', null);
			document.getElementById("add").disabled = false;
			if (index!= undefined && $scope.limit < 1){
				$scope.existing_lists[key].splice(index, 1);
				if ($scope.acc_lists[key].indexOf(value)<0){
					$scope.acc_lists[key].push(value);
					$scope.limit ++;
				}
			}
		} else {
			if($scope.value!=undefined){
				$scope.state = '{"info":$index%2==0,"danger":$index=={{master_index}}}';
				$scope.existing_lists[key] = $scope.value;
				$scope.value = undefined;
			}
		}
		$scope.updated_host = $scope.id;
		$scope.updated_val = angular.toJson($scope.existing_lists);
	}

	$scope.saveChanges = function() {
		$scope.time = Date.now(); //needs to be added to db for persistence
		$scope.update_string = "Last Updated ";
		$scope.save_status = true;
		$scope.initial_vals = JSON.stringify($scope.existing_lists);
		//sends a post http call to update all values that were modified
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
	          	// console.log("did not work");
	          })
	        $scope.modified_rows_index = [];
	        $scope.colorRow(null, null, true);
	        $scope.reset_buttons();
		}
	}

	$scope.envCheck = function(asset) {
		//changes color of header depending on env_tag
		if (asset['env_tag'] == "prod"){
			$scope.envClass = "panel-danger";
			$scope.env = asset['env_tag'] + " - ";
		}
		$scope.env = asset['env_tag'] + " - ";
	}

	$scope.runSuccessful = function(run){
		//checks for successful jobs
		if(run['retcode']===0){
			return true;
		} else {
			return false;
		}
	}

	$scope.jobSuccessful = function(job){
		//checks for successful jobs
		if(job['success']===true){
			return true;
		} else {
			return false;
		}
	}

	$scope.colorRow = function(row, index, saveFlag){
		if(saveFlag!=true){
			if (index%2==0 && $scope.initial_vals == JSON.stringify($scope.existing_lists)){
				return "info";
			}
			if ($scope.initial_vals != JSON.stringify($scope.existing_lists)){
				if ($scope.row_index == index){
					if($scope.modified_rows_index.indexOf($scope.row_index)<0){
						$scope.modified_rows_index.push($scope.row_index);
					}
				}
				for(row_index in $scope.modified_rows_index){
					if($scope.modified_rows_index[row_index] == index){
						return "danger";
					}
				}
				for(row_index in $scope.modified_rows_index){
					if(index%2==0 && $scope.modified_rows_index[row_index] != index){
						return "info";
					}
				}
			}
		} else {
			if (index%2==0){
				return "info";
			} else{
				return "default";
			}
		}
	}

	$scope.reset_buttons = function() {
		for(i = 0; i < 6; i++){
			try {
				document.getElementById("addBut"+i).disabled = false;
			    document.getElementById("remBut"+i).disabled = false;
			}
			catch(err) {
			    continue;
			}
		}
	}

	$scope.reset = function () {
		$scope.modified_rows_index = [];
		$('#add option').attr('selected', null);
		$('#rem option').attr('selected', null);
		$scope.reset_buttons();
		if($scope.save_status != true){
			reset_acc_lists = JSON.parse($scope.reset_acc_lists);
			$scope.existing_lists = JSON.parse($scope.initial_vals);
		} else {
			reset_acc_lists = $scope.acc_lists;
		}
		for (var k in $scope.existing_lists){
			if ($scope.existing_lists[k].constructor === Array){
				for(var nested in $scope.existing_lists[k]){
					if ($scope.acc_lists[k].indexOf($scope.existing_lists[k][nested])>=0){
						$scope.acc_lists[k].splice($scope.acc_lists[k].indexOf($scope.existing_lists[k][nested]), 1);
					}
				}
			}
		}
		for (var k in reset_acc_lists){
			for(var nested in reset_acc_lists[k]){
				try {
					if ($scope.existing_lists[k].indexOf(reset_acc_lists[k][nested])<0 && $scope.acc_lists[k].indexOf(reset_acc_lists[k][nested])<0){
						$scope.acc_lists[k].push(reset_acc_lists[k][nested]);
					}
				}
				catch(err) {
					continue;
				}
			}
		}
	}

	//ensures assets are not added to table multiple times by pressing back button
	if(get_counter === 0){
		$window.onload = $scope.addAssets();
		$window.onload = $scope.addEditableAssets();
		get_counter += 1;
	}


	if($scope.this_id && $scope.this_id.length<15){
		$scope.accessAsset($scope.this_id);
		$scope.accessJobs();
	} else if ($scope.this_id && $scope.this_id.length>15){
		$scope.accessRuns();
	}
	$scope.this_asset = assets.this_asset;
	$scope.this_pillar = assets.this_pillar;
	$scope.runs = assets.runs;
	$scope.this_job = assets.this_job;

}]);
