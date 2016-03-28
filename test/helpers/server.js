var fs = require('fs-extra')
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var _ = require("lodash");
var child_process = require('child_process');
var path = require('path');
var execSync = child_process.execSync;
var Slick = require('slick-io');

var Server = module.exports = function(configPath) {
  var server = this;
  this.path = '/tmp/slick/server';

  fs.ensureDirSync(this.path);
  fs.emptyDirSync(this.path);

  var slick = new Slick(this.path);
  slick.configure((setup, done) => {
    setup.meta.useMemory();
    setup.bulk.useMemory();
    done();
  }).whenReady(() => {
    fs.writeJsonSync(path.join(this.path, 'config.json'), {
      services: {
        web: {
          host: 'localhost',
          port: 8092
        }
      }
    });
    this.ready = true;
    this.emit('ready');
  })
  slick.start();
}
_.extend(Server.prototype, EventEmitter.prototype);

Server.prototype.start = function(cb) {
  var server = this;
  var root = path.join(__dirname, '../..')
  this._whenReady(function() {
    if (process.env.DEBUG) console.error('runnig server with path', server.path)

    var args = ['./bin/slick-server', '-R', server.path];
    var child = server.child = child_process.spawn(
      "node",
      args,
      {stdio: ['pipe', 'pipe', 'pipe'], cwd: root}
    );

    server.child.on('exit', function(status, signal) {
      if (process.env.DEBUG) console.error("server process just got an exit with", status, signal)
      server.emit('exiting');
      assert(signal === 'SIGTERM', "signal was "+signal+", expected SIGTERM");
    });

    server.child.stderr.on('data', function(data) {
      if (process.env.DEBUG) console.error("server(err):"+data);
    });

    server.child.stdout.on('data', function(data) {
      if (process.env.DEBUG) console.error("server(out):"+data);
      if (/API listening/.exec(data)) {
        cb();
      }
    });
  })
}

Server.prototype.stop = function(cb) {
  this.once('exiting', function() {
    if (process.env.DEBUG) console.error("stop is done");
    cb();
  });

  this.child.kill();
}

Server.prototype.restart = function(cb) {
  var server = this;
  this.stop(function() {
    server.start(function() {
      cb();
    });
  })
}

Server.prototype._whenReady = function(cb) {
  if (this.ready) return cb();
  this.once('ready', cb);
}