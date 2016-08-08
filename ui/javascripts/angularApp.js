//todo: need to fix the autofill bar to be the appropriate size
var get_counter = 0;
var assetsApp = angular.module('assetsApp', ['ui.router', 'ngSanitize', 'ngCsv']);

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
'CSV',
function($scope, assets, $http, $window, $location, CSV) {
	$scope.opts=["this", "that", "It Worked!!!!"];
	$scope.inside=[];
	$scope.sortType = 'host';
	$scope.sortReverse = false;
	$scope.search = '';
	$scope.assets = assets.assets;
	$scope.list_index = [];
	$scope.modified_rows_index = [];
	$scope.this_id = $location.search()['id'];
	$scope.possible_homepage_fields = [];
	$scope.selected_homepage_fields = {};
	//empty object which will contain all current values that are pulled from http call
	$scope.existing_lists ={};

	$scope.accessSearchKey = function(key){
		$scope.search_key = key;
	}

	$scope.p = function () {
		var substringMatcher = function(strs) {
		  return function findMatches(q, cb) {
		    var matches, substringRegex;

		    // an array that will be populated with substring matches
		    matches = [];

		    // regex used to determine if a string contains the substring `q`
		    substrRegex = new RegExp(q, 'i');

		    // iterate through the pool of strings and for any string that
		    // contains the substring `q`, add it to the `matches` array
		    $.each(strs, function(i, str) {
		      if (substrRegex.test(str)) {
		        matches.push(str);
		      }
		    });

		    cb(matches);
		  };
		};

		var options = $scope.acc_lists[$scope.search_key];

		$('#opts .typeahead').typeahead({
		  hint: true,
		  highlight: true,
		  minLength: 0
		},
		{
		  name: 'options',
		  source: substringMatcher(options)
		});
	}

	$scope.setSortType = function(field) {
		$scope.sortReverse=!$scope.sortReverse;
		$scope.sortType = field;
	}

	$scope.checkType = function(item) {
		if(item === undefined){
			item = "N/A";
			return "undefined";
		}
	    if (item.constructor === Object){
	    	$scope.pretty_obj = JSON.stringify(item, null, 2);
	   		return "dict";
		} else if (item.constructor === Array){
	   		return "arr";
		} else if (item.constructor === String || item.constructor === Number || item.constructor === Boolean) {
			return "str";
		} else {
			return "undefined";
		}
	};

	$scope.getProfileAndView = function() {
		$http.get('/api/config/').success(function(data) {
			//possible values lists
			$scope.acc_lists = {};
			$scope.pillar_attrs = {};
			$scope.default_pillar = data['default_pillar']['template'];
			for(var k in data){
				if(data[k]['_type']=='field'){
					$scope.acc_lists[data[k]['name']] = data[k]['values'];
					var pillar_attrs = {};
					pillar_attrs['visible'] = data[k]['visible'];
					pillar_attrs['editable'] = data[k]['editable'];
					pillar_attrs['type'] = data[k]['type'];
					$scope.pillar_attrs[data[k]['name']] = pillar_attrs;
				}
			}
			$scope.reset_acc_lists = JSON.stringify($scope.acc_lists);
		});
		$http.get('/api/profiles/').success(function(data) {
			if (data['_id'] == 'anonymous_user'){
				$scope.homepage_fields = data['default_fields'];
				$scope.authorizedUser = false;
			} else {
				if (data['custom_fields'] != undefined){
					$scope.homepage_fields = data['custom_fields'];
					$scope.selected_homepage_fields = data['checkbox_list'];
				} else{
					$scope.homepage_fields = data['default_fields'];
				}
				$scope.authorizedUser = true;
			}
			//$scope.authorizedUser = true;
		});
	}

	$scope.addAssets = function(id){
	    $http.get('/api/assets/').success(function(data, headers) {
	    	var max_length = 0;
			for (var i=0;i<data.length;i++){
				var asset_container = {};
				if(Object.keys(data[i]).length > max_length){
					max_length = Object.keys(data[i]).length
					$scope.lrgst_asset = data[i];
				}
			}
			for (var i=0;i<data.length;i++){
				var asset_container = {};
				for(var item in $scope.lrgst_asset){
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
			}
			$scope.createPossibleFieldsArray(assets.assets);
	    });
	};

	//populates possible_fields_array for homepage layout modification
	$scope.createPossibleFieldsArray = function (arr) {
		for(var i=0; i<arr.length; i++){
			for (var elem in arr[i]) {
				if($.inArray(elem, $scope.possible_homepage_fields)==-1){
					$scope.possible_homepage_fields.push(elem);
				}
				if($.inArray(elem, $scope.homepage_fields)>-1){
					$scope.selected_homepage_fields[elem]=true;
				} else {
					$scope.selected_homepage_fields[elem]=false;
				}
			}
		}
		$scope.possible_homepage_fields = $scope.possible_homepage_fields.sort();
	}

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
		});

    	//accessing pillar data here
		$http.get('/api/pillars/' + id).success(function(data) {
			pillar_container = {};
			if (data == null){
				for(var item in $scope.default_pillar) {
					if($scope.pillar_attrs[item]['visible']===false){
						continue;
					}
					pillar_container[item] = $scope.default_pillar[item];
				}
			}
			for(var item in data) {
				if($scope.pillar_attrs[item]['visible']===false){
					continue;
				}
				pillar_container[item] = data[item];
			}
			assets.getPillar(pillar_container);
		    for (var item in pillar_container) {
				$scope.existing_lists[item] = pillar_container[item];					
			}
			$scope.envCheck(pillar_container);
			for (var item in assets.this_pillar[0]){
				$scope.list_index.push(item);
				if (assets.this_pillar[0][item].constructor === Array){
					for(var nested in assets.this_pillar[0][item]){
						//removes any values from acc_lists if they exist in existing_lists
						try{
							if ($scope.acc_lists[item].indexOf(assets.this_pillar[0][item][nested])>=0){
								$scope.acc_lists[item].splice($scope.acc_lists[item].indexOf(assets.this_pillar[0][item][nested]), 1);
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

	$scope.saveHomepageLayout = function () {
		for (elem in $scope.selected_homepage_fields){
			if ($scope.selected_homepage_fields[elem]==false){
				if($.inArray(elem, $scope.homepage_fields)>-1){
					$scope.homepage_fields.splice($scope.homepage_fields.indexOf(elem), 1);
				}
			}
			if ($scope.selected_homepage_fields[elem]==true){
				if($.inArray(elem, $scope.homepage_fields)==-1){
					$scope.homepage_fields.push(elem);
				}
			}
		}
		$scope.homepage_fields.sort();
		if($.inArray('host', $scope.homepage_fields)>-1){
			$scope.homepage_fields.splice($scope.homepage_fields.indexOf('host'),1);
			$scope.homepage_fields.unshift('host');
		}
		if($.inArray('hostname', $scope.homepage_fields)>-1){
			$scope.homepage_fields.splice($scope.homepage_fields.indexOf('hostname'),1);
			$scope.homepage_fields.unshift('hostname');
		}
		$scope.saveLayout();
	}

	$scope.saveLayout = function() {
		//sends a post http call to update homepage layout
		if(1==1) {
	        $http({
	          method  : 'POST',
	          url     : '/api/profiles/',
	          data    : $.param({
	        	fields: angular.toJson($scope.homepage_fields),
	        	layout: angular.toJson($scope.selected_homepage_fields)
	        }),
	          headers : {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'} 
	         })
	          .success(function(data) {
	          }).error(function(data){
	          	// console.log("did not work");
	          })
		}
	}

	$scope.collectElems = function(item, removeFlag){
		//called whenever a value is clicked to grab information
		if(item != undefined){
			obj = JSON.parse(item);
			$scope.index = obj[Object.keys(obj)[0]];
			$scope.value = Object.keys(obj)[0].substr(0, Object.keys(obj)[0].indexOf(','));
			$scope.key = Object.keys(obj)[0].substr(Object.keys(obj)[0].indexOf(',')+1);
			$scope.limit = 0;
		}
		$scope.master_index = $scope.list_index.sort().indexOf($scope.key);
		//disables add/remove button depending on if clicked value is in acc_lists/existing_lists
		try {
			if(removeFlag===true){
			    document.getElementById("addBut"+$scope.master_index).disabled = true;
			    document.getElementById("remBut"+$scope.master_index).disabled = false;
			}
			if(removeFlag===false){
				document.getElementById("remBut"+$scope.master_index).disabled = true;
				document.getElementById("addBut"+$scope.master_index).disabled = false;
			}
		} catch (e) {

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
			if(value!=undefined){
				$scope.state = '{"info":$index%2==0,"danger":$index=={{master_index}}}';
				$scope.existing_lists[key] = value;
				$value = undefined;
			}
		}
		$scope.updated_host = $scope.this_id;
		$scope.updated_val = angular.toJson($scope.existing_lists);
	}

	$scope.createExportData = function (){
		var filtered_data = [];
		for (var i=0; i<$scope.filtered_data.length; i++) {
			var filtered_part = {}
			for(item in $scope.filtered_data[i]){
				for (var j=0; j<$scope.homepage_fields.length; j++){
					if (item == 'host'){
						filtered_part[item] = $scope.filtered_data[i][item];
					}
				}
			}
			for (item in $scope.filtered_data[i]){
				for (var j=0; j<$scope.homepage_fields.length; j++){
					if ($scope.homepage_fields[j] == item && item != 'host'){
						if ($scope.checkType($scope.filtered_data[i][item]) == 'arr'){
							filtered_part[item] = JSON.stringify($scope.filtered_data[i][item].join(", "));
						} else if ($scope.checkType($scope.filtered_data[i][item]) == 'dict') {
							filtered_part[item] = JSON.stringify($scope.filtered_data[i][item]);
						} else {
							filtered_part[item] = $scope.filtered_data[i][item];
						}
					}
				}
			}
			filtered_data.push(filtered_part);
		}
		$scope.filtered_data = filtered_data;
		return $scope.filtered_data;
	}

	$scope.saveChanges = function() {
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

	$window.onload = $scope.getProfileAndView();

	//ensures assets are not added to table multiple times by pressing back button
	if(get_counter === 0){
		$window.onload = $scope.addAssets();
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
