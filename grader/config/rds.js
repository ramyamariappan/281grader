var mysql     =    require('mysql');
var rdspool   =    mysql.createPool({
    connectionLimit : 20, //important
    host     : 'aws281db.canvcdgknoln.us-west-1.rds.amazonaws.com',
    user     : 'awsuser',
    password : 'guest123',
    database : 'graderdb',
    debug    :  false
});
module.exports = rdspool;