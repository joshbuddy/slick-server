var sprintf = require('sprintf-js').sprintf;
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
    .description('List operations')
    .action(function(opts) {
      runner = new List(opts);
    });

  program
    .command('cancel <id>')
    .description('Cancel an operation')
    .action(function(id, opts) {
      runner = new Cancel(id, opts);
    });

  program
    .command('wait [id]')
    .description('Wait for an operation to complete')
    .action(function(id, opts) {
      runner = new Wait(id, opts);
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
    path: '/api/operations',
    method: 'GET'
  };
  this._requestJSON(requestOptions, (err, response) => {
    if (err) return cb(err);
    response.operations.forEach((op) => {
      console.log(sprintf("%-10s %-10s %s => %s:%s (%s)", op.id, op.state, op.sources.join(', '), op.volume, op.destination, op.mode));
    });
    cb();
  });
}

var Cancel = function(id, opts) {
  this.id = id;
  Rest.call(this, opts);
}
_.extend(Cancel.prototype, Rest.prototype);

Cancel.prototype._run = function(cb) {
  var list = this;
  var requestOptions = {
    path: '/api/operations/'+this.id,
    method: 'DELETE'
  };
  this._request(requestOptions, (err, response) => {
    if (err) return cb(err);
    switch(response.statusCode) {
      case 204:
        cb();
        break;
      default:
        cb(`unexpected status code ${response.statusCode}`);
        break;
    }
  });
}

var Wait = function(id, opts) {
  this.id = id;
  Rest.call(this, opts);
}
_.extend(Wait.prototype, Rest.prototype);

Wait.prototype._run = function(cb) {
  this._processEventSource('/api/operations/'+this.id, (err, response) => {
    if (err) return cb(err);
    cb();
  });
}
