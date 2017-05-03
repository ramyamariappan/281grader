var mysql     =    require('mysql');
var rdspool   =    mysql.createPool({
    connectionLimit : 20, //important
    host     : 'localhost',
    user     : 'root',
    password : 'guest',
    database : 'cmpe281',
    debug    :  false
});
module.exports = rdspool;