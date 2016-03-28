var fs = require('fs-extra');
var colors = require('colors');
var path = require('path');
var _ = require('lodash');

var Rest = require('./rest');

module.exports = function() {
  var program = Rest.runner();
  var runner;

  program
    .command('list')
    .description('List volumes')
    .action(function(opts) {
      runner = new List(opts);
    });

  program
    .command('create <name>')
    .description('Create a new volume')
    .option('-d, --description <desc>', 'Description of volume')
    .action(function(name, opts) {
      runner = new Create(name, opts);
    });

  program
    .command('destroy <name>')
    .description('Destroy a new volume')
    .action(function(name, opts) {
      runner = new Destroy(name, opts);
    });

  program.on('--help', function(){
    console.error("HELP!");
  });

  var out = program.parse(process.argv);

  if (!runner) {
    runner = new List(program.opts());
  }
  runner.run();
}

var List = function(opts) {
  Rest.call(this, opts);
}
_.extend(List.prototype, Rest.prototype);

List.prototype._run = function(cb) {
  var list = this;
  var requestOptions = {
    path: '/api/volumes',
    method: 'GET'
  };
  this._requestJSON(requestOptions, function(err, response) {
    if (err) return cb(err);

    response.volumes.forEach(function(entry) {
      console.log(entry.name);
    })
    cb()
  });
}

var Create = function(name, opts) {
  this.name = name;
  this.description = typeof(opts.description) === 'string' ? opts.description : null;
  Rest.call(this, opts);
}
_.extend(Create.prototype, Rest.prototype);

Create.prototype._run = function(cb) {
  var buffer = new Buffer(JSON.stringify({name: this.name}), 'utf-8');
  var requestOptions = {
    path: '/api/volumes',
    method: 'POST'
  };
  this._requestJSON(requestOptions, buffer, cb);
}

var Destroy = function(name, opts) {
  this.name = name;
  Rest.call(this, opts);
}
_.extend(Destroy.prototype, Rest.prototype);

Destroy.prototype._run = function(cb) {
  var requestOptions = {
    path: path.join('/api/volumes', encodeURIComponent(this.name)),
    method: 'DELETE'
  };
  this._requestJSON(requestOptions, cb);
}
