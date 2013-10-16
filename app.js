var express = require('express');
//var mysql = require('mysql');
var mysql = require('mysql2');

var app = express();

app.use(express.compress());

var pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: 'gignal',
  charset: 'LATIN1_SWEDISH_CI'
});

app.get('/ping', function (req, res) {
  res.end('pong');
});

app.get('/fetch/:id', function (req, res) {

  var offset = req.query.offset;
  var limit = parseInt(req.query.limit || 20);
  var sinceTime = parseInt(req.query.sinceTime || 0);

  if (limit > 100) limit = 100;

  var fields = 'stream_id, original_id, service, username, user_id, name, user_image, text, thumb_photo, large_photo, UNIX_TIMESTAMP(created_on) AS created_on, UNIX_TIMESTAMP(saved_on) AS saved_on, created_on as creation, admin_entry, type';
  var sql = 'SELECT ' + fields + ' FROM stream WHERE event_id = (SELECT event_id FROM events WHERE event_uuid = ?)';

  if (sinceTime) {
    if (offset) {
      sql += ' AND created_on < FROM_UNIXTIME(?)';
    } else {
      sql += ' AND created_on > FROM_UNIXTIME(?)';
    }
  }

  sql += ' ORDER BY created_on DESC';
  sql += ' LIMIT ?';

  pool.getConnection(function (err, connection) {

    if (err) {
      console.error(err);
      res.json(500, {error: true});
      return false;
    }

    if (sinceTime) {
      var param = [req.params.id, connection.escape(sinceTime), connection.escape(limit)]
    } else {
      var param = [req.params.id, connection.escape(limit)]
    }

    //connection.query(sql, [req.params.id], function (err, rows) {
    connection.execute(sql, param, function (err, rows) {

      //connection.release();
      connection.end();

      if (err) {
        console.error(err);
        res.json(500, {error: true});
        return false;
      }

      if (sinceTime) {
        res.setHeader('Cache-Control', 'max-age=10');
      } else {
        res.setHeader('Cache-Control', 'max-age=300');
      }

      res.jsonp({
        stream: rows
      });

    });

  });

});

app.listen(process.env.PORT || 3000);
