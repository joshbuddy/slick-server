var fs = require('fs-extra');
var path = require('path');
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var request = require('request');

var Rest = require('./rest');

module.exports = function() {
  var program = Rest.runner();
  var runner;

  program
    .arguments('<source> <destination>')
    .description('Fetches files from a volume')
    .action(function(source, destination, opts) {
      runner = new Fetch(source, destination, opts);
    });

  program.parse(process.argv);

  if (!runner) {
    console.error("must specify target")
    process.exit(1);
  }

  runner.run();
}

var Fetch = function(source, destination, opts) {
  this.source = this._parsePath(source);
  this.pendingSources = [];
  this.fetchCount = 0;
  this.force = opts.force;

  if (fs.existsSync(destination)) {
    if (fs.statSync(destination).isDirectory()) {
      this.destination = path.join(destination, path.basename(this.source.path));
    } else if (!this.force) {
      cb(`cannot fetch, \`${destination}' already exists`);
    }
  } else {
    this.destination = destination;
  }

  Rest.call(this, opts);
}
_.extend(Fetch.prototype, Rest.prototype);
_.extend(Fetch.prototype, EventEmitter.prototype);

Fetch.prototype._run = function(cb) {
  var headOptions = {
    path: `/api/volumes/${this.source.name}/file${this.source.path}`,
    method: 'HEAD'
  }

  this._request(headOptions, (err, res) => {
    if (err) return cb(err);

    switch(res.statusCode) {
      case 200:
        switch(res.headers['x-slick-type']) {
          case 'folder':
            this._fetchFolder(this.source.path, this.destination, (err) => {
              if (err) return cb(err);
              this.once('complete', cb);
            });
            break;
          case 'file':
            this.once('complete', cb);
            this._fetchFile(this.source.path, this.destination);
            break;
          default:
            cb("unknown type "+res.headers['x-slick-type']);
        }
        break;
      default:
        cb(res.statusMessage);
        break;
    }

  })
}

Fetch.prototype._fetchFolder = function(source, destination, cb) {
  fs.ensureDirSync(destination);

  var requestOptions = {
    path: `/api/volumes/${this.source.name}/entries${source}`,
    method: 'GET'
  };

  this._requestJSON(requestOptions, (err, response) => {
    if (err) return cb(err);

    var processEntry = (index) => {
      if (index === response.entries.length) return cb();

      var entry = response.entries[index];
      if (entry.folder) {
        this._fetchFolder(path.join(source, entry.name), path.join(destination, entry.name), (err) => {
          if (err) return cb(err);
          processEntry(index + 1);
        });
      } else {
        this._fetchFile(path.join(source, entry.name), path.join(destination, entry.name));
        processEntry(index + 1);
      }
    }
    processEntry(0);
  });
}

Fetch.prototype._fetchFile = function(source, destination) {
  this.pendingSources.push([source, destination]);
  this._processSources();
}

Fetch.prototype._processSources = function() {
  if (this.fetchCount > 20) return;
  if (this.pendingSources.length === 0) {
    if (this.fetchCount === 0) this.emit('complete');
    return;
  }

  this.fetchCount++;
  var sourceDestination = this.pendingSources.shift();
  var source = sourceDestination[0], destination = sourceDestination[1];
  console.error('fetching %s to %s', source, destination);

  request(`${this.baseUrl}/api/volumes/${this.source.name}/file${source}`)
    .on('error', (err) => { console.error("error fetching", err); process.exit(1) })
    .on('end', () => {
      this.fetchCount--;
      this._processSources();
    })
    .pipe(fs.createWriteStream(destination));
}
