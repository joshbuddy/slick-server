var colors = require('colors');
var path = require('path');
var fs = require('fs-extra');
var expandHomeDir = require('expand-home-dir');
var ProgressBar = require('progress');
var http = require('http');
var https = require('https');
var blake2 = require('blake2');
var parseUrl = require('url').parse;
var EventSource = require('eventsource');

var packageJson = fs.readJsonSync(path.join(__dirname, '..', 'package.json'));

var Rest = module.exports = function(opts) {
  this.baseUrl = (opts.parent ? opts.parent.slickUrl : opts.slickUrl) || process.env.SLICK_URL || 'http://localhost:8091';
}

Rest.runner = function() {
  var program = require('commander');
  program
    .option('--slick-url <url>', 'The slick url to connect to')
    .version(packageJson.version);

  return program;
}

Rest.prototype.run = function() {
  var base = this;

  var handleRunError = function(err) {
    console.error("Error running:", err);
    process.exit(1);
  }
  this._run(function(err) {
    if (err) return handleRunError(err);
    process.exit(0);
  });
}

Rest.prototype._request = function(options, data, cb) {
  if (!cb) {
    cb = data;
    data = null;
  }

  var base = this;
  var parsedUrl = parseUrl(this.baseUrl);
  var ssl = parsedUrl.protocol === 'https:';
  var agentOptions = { keepAlive: true, maxSockets: 20 };
  var agent = new (ssl ? https.Agent : http.Agent)(agentOptions);
  options.port = parsedUrl.port;
  options.agent = agent;
  if (!options.port) options.port = ssl ? 443 : 80;
  options.hostname = parsedUrl.hostname;

  if (data) {
    if (!options.headers) options.headers = {};
    options.headers['Content-type'] = 'application/json';
    options.headers['Content-length'] = data.length;
  }

  var requestFn = (ssl ? https : http).request;
  var request = requestFn(options, function(res) {
    cb(null, res);
  })
  request.once('error', function(err) {
    cb(err);
  })
  if (data) request.write(data);
  request.end();
}

Rest.prototype._requestJSON = function(options, data, cb) {
  if (!cb) {
    cb = data;
    data = null;
  }

  var base = this;
  this._request(options, data, function(err, res) {
    if (err) return cb(err);
    switch(res.statusCode) {
      case 200:
      case 201:
        var buffers = [];
        res.on('data', function(chunk) {
          buffers.push(chunk);
        });
        res.once('end', function() {
          var data = JSON.parse(Buffer.concat(buffers).toString('utf-8'));
          cb(null, data);
        });
        break;
      case 204:
        cb();
        break;
      case 303: // continues
        if (options.doNotFollow) return cb(null, res.headers.location);
        base._processEventSource(res.headers.location, cb);
        break;
      case 400:
        var buffers = [];
        res.on('data', function(chunk) {
          buffers.push(chunk);
        });
        res.once('end', function() {
          var data = Buffer.concat(buffers).toString('utf-8');
          cb(data);
        });
        break;
      case 404:
        cb("not found");
        break;
      default:
        cb("error, unexpected status code "+res.statusCode);
        break;
    }
  })
}

Rest.prototype._responseAsJson = function(res, cb) {
  var buffers = [];
  res.on('data', function(chunk) {
    buffers.push(chunk);
  });
  res.once('end', function() {
    var data = JSON.parse(Buffer.concat(buffers).toString('utf-8'));
    cb(null, data);
  });
}

Rest.prototype._processEventSource = function(location, cb) {
  var base = this;
  var bar = new ProgressBar('[:bar] :percent :elapseds :etas', {
    complete: '=',
    incomplete: ' ',
    width: 30,
    total: 1
  });
  bar.start = new Date;

  var processData = function(data, processCb) {
    switch(data.state) {
      case 'warning':
        console.error('WARNING %s', data.message);
        break;
      case 'progress':
        bar.total = data.total;
        bar.curr = data.current;
        bar.tick(0);
        break;
      case 'completed':
        console.log("Operation completed!");
        processCb();
        break;
      case 'error':
        console.log("Operation errored out");
        processCb("error returned from event stream:"+data.message);
        break;
      case 'canceled':
        console.error("Operation canceled");
        processCb();
        break;
    }
  }

  process.on('SIGINT', function() {
    console.log("Canceling operation");
    var requestOptions = {
      path: location,
      method: 'DELETE'
    };
    base._requestJSON(requestOptions, function(err) {
      if (err) {
        console.log("Error canceling operation", err);
        return process.exit(1);
      }
    })
  });

  this._requestJSON({path:location}, function(err, response) {
    if (err) return cb(err);
    var url = base.baseUrl + response.operation.events;
    var es = new EventSource(url);
    es.onmessage = function(e) {
      var data = JSON.parse(e.data);
      processData(data, function(err) {
        es.close();
        cb(err);
      });
    };
    es.onerror = function(err) {
      es.close();
      cb("error processing stream "+String(err));
    };
    es.onclose = function() {
      cb('error, event stream unexpectedly closed');
    }
  })

}

Rest.prototype._parsePath = function(path) {
  var match = path.match(/^([^:]+):(\/.*)$/);
  if (!match) {
    console.error('path does not match volume:/path, is instead', path);
    return process.exit(1);
  }
  return {name: match[1], path: match[2]};
}
