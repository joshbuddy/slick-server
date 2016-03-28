var strftime = require('strftime')
var _ = require('lodash')
var colors = require('colors');
var path = require('path');
var util = require('util');
var sprintf = require('sprintf-js').sprintf;

var Rest = require('./rest');

module.exports = function() {
  var program = Rest.runner();
  var runner;

  program
    .arguments('<target>')
    .option('-l, --long', 'Long output')
    .option('-f, --full', 'Show full paths')
    .option('-U', 'Use creation time in long output')
    .action(function(target, opts) {
      runner = new List(target, opts);
    });

  program.parse(process.argv);

  if (!runner) {
    console.error("must specify target")
    process.exit(1);
  }

  runner.run();
}

var List = function(target, opts) {
  this.target = target;
  this.recursive = opts.recursive;
  this.long = opts.long;
  this.useCreateTime = opts.U;
  this.full = opts.full;
  Rest.call(this, opts);
}
_.extend(List.prototype, Rest.prototype);

List.prototype._run = function(cb) {
  var list = this;
  var target = this._parsePath(this.target);
  var basePath = path.join('/api/volumes', encodeURIComponent(target.name), 'entries', encodeURI(target.path));
  var requestOptions = {
    path: basePath,
    method: 'GET'
  };
  this._requestJSON(requestOptions, function(err, response) {
    if (err) return cb(err);
    response.entries.forEach(function(entry) {
      list._displayEntry(entry);
    })
    cb();
  });
}

List.prototype._displayEntry = function(entry) {
  var name = this.full ? entry.fullpath : entry.name
  var formattedName = entry.folder ? name.cyan : name;
  var useCreateTime = this.useCreateTime;
  if (this.long) {
    var time = strftime("%b %d %H:%M:%S", new Date(useCreateTime ? entry.ctime : entry.mtime));
    var type = entry.folder ? 'folder' : entry.type
    var digestFragment = entry.digest ? entry.digest.substring(0, 6) : '      ';
    console.log(sprintf("%s %-30s %s %15s %s", digestFragment, time, type, entry.size, formattedName));
  } else {
    console.log(formattedName);
  }
}