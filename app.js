var express = require('express');
var mysql = require('mysql2');

var app = express();
app.use(express.compress());

// validate req.params if its a regular expression
app.param(function (name, fn) {
  if (fn instanceof RegExp) {
    return function (req, res, next, val) {
      var captures;
      if (captures = fn.exec(String(val))) {
        req.params[name] = captures;
        next();
      } else {
        next('route');
      }
    }
  }
});

var pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: 'gignal',
  compress: true
});

app.get('/ping', function (req, res) {
  res.end('pong');
});

var fields = 'stream_id, original_id, service, username, user_id, name, user_image, text, thumb_photo, large_photo, UNIX_TIMESTAMP(created_on) AS created_on, UNIX_TIMESTAMP(saved_on) AS saved_on, created_on as creation, admin_entry, type';
var sql = 'SELECT ' + fields + ' FROM stream WHERE event_id = (SELECT event_id FROM events WHERE event_uuid = ?)';

var uuid_re = /[a-fA-F0-9]+/

app.param('uuid', uuid_re);

app.get('/fetch/:uuid', function (req, res) {

  var uuid = req.params.uuid;
  var offset = parseInt(req.query.offset || false);
  var limit = parseInt(req.query.limit || 20);
  var sinceTime = parseInt(req.query.sinceTime || false);

  if (limit > 100) limit = 100;

  var query = sql;

  if (sinceTime) {
    if (offset) {
      query += ' AND created_on < FROM_UNIXTIME(?)';
    } else {
      query += ' AND created_on > FROM_UNIXTIME(?)';
    }
  }

  query += ' ORDER BY created_on DESC';
  query += ' LIMIT ?';

  pool.getConnection(function (err, connection) {

    if (err) {
      console.error(err);
      res.json(500, {error: err});
      return false;
    }

    if (sinceTime) {
      var param = [uuid, connection.escape(sinceTime), connection.escape(limit)]
    } else {
      var param = [uuid, connection.escape(limit)]
    }

    connection.execute(query, param, function (err, rows) {

      //connection.release();
      connection.end();

      if (err) {
        console.error(err);
        res.json(500, {error: err});
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
