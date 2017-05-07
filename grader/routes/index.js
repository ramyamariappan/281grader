var express = require('express');
var router = express.Router();
var fs = require('fs');
var unzip = require('unzip2');
var del = require('del');
var parsePaths = require('../config/parsePaths');
var lb = require('../config/lb.js');

var isAuthenticated = function (req, res, next) {
	// if user is authenticated in the session, call the next() to call the next request handler 
	// Passport adds this method to request object. A middleware is allowed to add properties to
	// request and response objects
	if (req.isAuthenticated())
		return next();
	// if the user is not authenticated then redirect him to the login page
	res.redirect('/');
}

module.exports = function(passport,pool, uploads){

	/* GET login page. */
	router.get('/', function(req, res) {
    	// Display the Login page with any flash message, if any
		res.render('index', { message: req.flash('message') });
	});

	/* Handle Login POST */
	router.post('/login', passport.authenticate('login', {
		successRedirect: '/home',
		failureRedirect: '/',
		failureFlash : true  
	}));

	/* Handle Login POST */
	router.post('/:username/login', function(req, res){
		passport.authenticate('login', {
		successRedirect: '/'+req.params.username+'/home',
		failureRedirect: '/'+req.params.username+'/',
		failureFlash : true  
	})});

	/* GET Registration Page */
	router.get('/signup', function(req, res){
		res.render('register',{message: req.flash('message')});
	});

	/* Handle Registration POST */
	router.post('/signup', passport.authenticate('signup', {
		successRedirect: '/home',
		failureRedirect: '/signup',
		failureFlash : true  
	}));

	/* GET Home Page */
	router.get('/home', isAuthenticated, function(req, res){
		pool.getConnection(function(err, conn){
           
		conn.query("select * from TENANTS_FIELDS  where TENANT_ID = ?",[req.user.username], 
        	function(err, rows) {
                 var results = JSON.parse(JSON.stringify(rows));
                 console.log(results);
                 console.log("~~~~~~~~~~~~~~~~~ "+lb.loadbalancer);
                 console.log("~~~~~~~~~~~~~~~~~ "+req.header.host);
                 var gradeLink = "http://"+lb.loadbalancer+"/"+req.user.username+"/grade";
                 res.render('home', { user: req.user , fields : results, gradeLink: gradeLink});
            });
		conn.release();

		});


		
	});

	/* Handle Logout */
	router.get('/signout', function(req, res) {
		req.logout();
		res.redirect('/');
	});

	/* Handle Redirection to grading page */
	router.get('/:username/grade', function(req, res) {	
		pool.getConnection(function(err, conn){
           
		conn.query("select * from TENANTS_FIELDS  where TENANT_ID = ?",[req.user.username], 
        	function(err, rows) {
                 var results = JSON.parse(JSON.stringify(rows));
                 console.log("~~~~~~~~~~~~~~~~~ "+results);
         		 console.log("~~~~~~~~~~~~~~~~~ "+lb.loadbalancer);
                 res.render('grade', { user: req.user , fields : results});
                 
            });
		conn.release();

		});		
	});

	/* Handle Redirection to grading page */
	router.post('/:username/unzip', uploads.single('zipfile'),function(req, res) {
		
 
		del(['./unzipped/*.*']).then(paths => {
		    console.log('Deleted files and folders:\n', paths.join('\n'));
		});
		del(['./uploads/*.*']).then(paths => {
		    console.log('Deleted files and folders:\n', paths.join('\n'));
		});

      	setTimeout(function(){console.log('waiting');
      		var p = 'parsePaths.'+req.params.username;
      		
      		console.log(eval(p));

			fs.createReadStream(req.file.path).pipe(unzip.Extract({ path: './unzipped' }));

			var exec = require('child_process').exec;
			//var child = exec('java -jar umlparserB.jar ./unzipped ./unzipped/uml.png',
			var child = exec(eval(p),
			  function (error, stdout, stderr){
			    console.log('Output -> ' + stdout);
			    if(error !== null){
			      console.log("Error -> "+error);
			    }
			})
		},1000);		

		setTimeout(function() {
		    fs.readFile('./unzipped/uml.png',
		        function (err, data) {
		        	pool.getConnection(function(err, conn){
           
					conn.query("select * from TENANTS_FIELDS  where TENANT_ID = ?",[req.user.username], 
			        	function(err, rows) {
			                 var results = JSON.parse(JSON.stringify(rows));
			                 console.log("~~~~~~~~~~~~~~~~~ "+results);
			         
			                 res.render('grade', { user: req.user , src: data.toString('base64'), fields : results});
			            });
					conn.release();


					});	
					//res.render('grade', { user: req.user, src: data.toString('base64'), fields: req.fields});
				})
		}, 5000);

	});

	/* Save Grading */
	router.post('/saveGradingAttributes', function(req, res) {
    	
	  	var scale = req.body.scale;
        var points = req.body.points
        var comments = req.body.comments;
        var completion = req.body.completion;


 		if(scale) {
      		console.log('checked : ' + req.body.scale);
	 	}
	 	else{
	 		console.log('not checked : ' + req.body.scale);
	 		console.log(scale != undefined);
	 	}

        pool.getConnection(function(err, conn){
            console.log(scale);

            conn.query("select * from TENANTS_TABLE  where TENANT_ID = ?",[req.user.username], 
            	function(err, rows) {
	                 var results = JSON.parse(JSON.stringify(rows));
	                 console.log(results);
	                 console.log(rows.length);
	                 if(rows.length ==0){
	                 	var insert="INSERT INTO TENANTS_TABLE (TENANT_ID,TENANT_EMAIL)" 
            			+" VALUES(?,?)";
			            conn.query(insert,[req.user.username,req.user.email],
			            function (er, results, rows, fields){
			                if (er) {
			                   console.log("Error "+JSON.stringify(er));
			                   res.status(500).send(er);
			                } else{
			                   res.status(200).json(results);
			                }
			                
			            });
	                 }
	            });
           

            var insert="INSERT INTO TENANTS_FIELDS (TENANT_ID,FIELD_NAME, FIELD_ENABLE)" 
            			+" VALUES(?,?,?), (?,?,?), (?,?,?), (?,?,?) ON DUPLICATE KEY UPDATE" 
            			+" FIELD_ENABLE = VALUES(FIELD_ENABLE) ";
            conn.query(insert,[req.user.username,"scale", (scale !=undefined?"1":"0"), 
            	req.user.username,"points",(points !=undefined?"1":"0"),
            	req.user.username,"comments",(comments !=undefined?"1":"0"),
            	req.user.username,"completion",(completion !=undefined?"1":"0")
            	],function (er, results, rows, fields){
                if (er) {
                   //console.log("Error "+JSON.stringify(er));
                   res.status(500).send(er);
                } else{
                   //res.status(200).json(results);
                   //res.render('home', { user: req.user,fields : results });
                }
                conn.release();
            });

            conn.query("select * from TENANTS_FIELDS  where TENANT_ID = ?",[req.user.username], 
        	function(err, rows) {
                 var results = JSON.parse(JSON.stringify(rows));
                 console.log(results);
                 res.render('home', { user: req.user , fields : results});
            });

	        });
	});

	/* Save Grading */
	router.post('/:username/saveGrades', function(req, res) {
    	
	  	var scale = req.body.scale;
        var points = req.body.points
        var comments = req.body.comments;
        var completion = req.body.completion;

        pool.getConnection(function(err, conn){
            console.log(scale);           

            var insert="INSERT INTO TENANTS_GRADES (TENANT_ID,FIELD_NAME, FIELD_VALUE)";
            var flag = false;
            if(scale != undefined){
            	insert+=" VALUES('"+req.user.username+"','scale','"+scale+"')";
            	flag = true;
            }
            if(points != undefined){
            	if(flag ==true) insert+=",";
            	insert+="('"+req.user.username+"','points','"+points+"')";
            	flag = true;
            } 
            if(comments != undefined){
            	if(flag ==true) insert+=",";
            	insert+="('"+req.user.username+"','comments','"+comments+"')";
            	flag = true;
            } 
            if(completion != undefined){
            	if(flag ==true) insert+=",";
            	insert+="('"+req.user.username+"','completion','"+completion+"')";
            	flag = true;
            } 
            
            insert+=" ON DUPLICATE KEY UPDATE FIELD_VALUE = VALUES(FIELD_VALUE) ";
            console.log("insert query : " + insert);
            conn.query(insert,function (er, results, rows, fields){
            	var info;
                if (er) {
                   //console.log("Error "+JSON.stringify(er));
                   res.status(500).send(er);
                   info ='failure';
                } else{
                   //res.status(200).json(results);
                   info = 'Graded Successfully!';
                   res.render('graded', { user: req.user,info : info });
                }
                conn.release();
            });

	        });
	});

	return router;
}