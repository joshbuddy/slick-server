var fs = require('fs-extra');
var path = require('path');
var _ = require('lodash');

var Rest = require('./rest');

module.exports = function() {
  var program = Rest.runner();
  var runner;

  program
    .arguments('<destination> <source> [otherSources...]')
    .description('Adds files to volume')
    .option('-c, --conflict [mode]', 'Conflict resolution mode for path conflicts, rename, replace, skip defaults to rename')
    .option('-b, --background', 'Perform add in background')
    .action(function(destination, source, otherSources, opts) {
      var sources = [source].concat(otherSources);
      runner = new Add(destination, sources, opts);
    });

  program.parse(process.argv);

  if (!runner) {
    console.error("must specify target")
    process.exit(1);
  }

  runner.run();
}

var Add = function(destination, sources, opts) {
  this.destination = destination;
  this.sources = sources;
  this.conflict = opts.conflict || 'rename';
  this.background = opts.background;

  Rest.call(this, opts);
}
_.extend(Add.prototype, Rest.prototype);

Add.prototype._run = function(cb) {
  var destination = this._parsePath(this.destination);
  var sources = _.map(this.sources, function(source) { return path.resolve(source); });
  var conflict = this.conflict;

  var body = {
    type: 'add',
    conflict: this.conflict,
    sources: sources,
    destination: destination
  };
  var buffer = new Buffer(JSON.stringify(body), 'utf-8');
  var requestOptions = {
    path: '/api/operations',
    method: 'POST'
  };

  if (this.background) {
    requestOptions.doNotFollow = true;
    this._requestJSON(requestOptions, buffer, function(err, location) {
      if (err) return cb(err);
      var id = location.match(/operations\/(\d+)/)[1];
      console.log("Operation starting, id "+id);
      cb();
    });
  } else {
    this._requestJSON(requestOptions, buffer, function(err) {
      if (err) return cb(err);
      cb();
    });
  }

}
