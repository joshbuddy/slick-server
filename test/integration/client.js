var fs = require('fs')
var path = require('path');
var child_process = require('child_process');
var execSync = child_process.execSync;

var Lock = require('slick-io/lib/util/lock');

var Client = module.exports = function(noUrl) {
  this.matchers = [];
  this.noUrl = noUrl;
  this.lock = new Lock();
}

Client.prototype.run = function() {
  var client = this;
  var args = [];
  var cb = arguments[arguments.length - 1];
  if (typeof(cb) !== 'function') cb = null;

  var len = cb ? arguments.length - 1 : arguments.length;
  for (var i = 0; i !== len; i++) {
    args.push(arguments[i]);
  }
  var command = args.join(' ');
  args.push(function(code, stdout, stderr) {
    if (code !== 0) {
      if (process.env.DEBUG) console.error('error running command `' + command + '\', expected exit code 0, got '+code+', out:\n'+stdout+"\nerr:\n"+stderr);
      assert(false, 'expected command to return status 0, returned '+code+' instead');
    }

    if (cb) cb(stdout);
  })

  Client.prototype.runWithCode.apply(client, args);
}

Client.prototype.write = function(regex, answer) {
  this._write(regex, answer, false);
}

Client.prototype.writeEnd = function(regex, answer) {
  this._write(regex, answer, true);
}

Client.prototype.runWithCode = function() {
  var args = ['./bin/slick'];
  for (var i = 0, len = arguments.length - 1; i !== len; i++) {
    args.push(arguments[i]);
  }

  if (!this.noUrl) {
    args.push('--slick-url')
    args.push('http://localhost:8092')
  }

  var cb = arguments[arguments.length - 1];
  var client = this;

  setImmediate(function() {
    client.lock.acquire('running command', function(release) {
      var outPath = '/tmp/out'+process.pid;
      var out = fs.createWriteStream(outPath);
      out.on('open', function() {
        if (process.env.DEBUG) console.error('Running', args);
        var child = client.child = child_process.spawn('node', args, {stdio: ['pipe', 'pipe', 'pipe'], cwd: path.join(__dirname, '../..')});
        var stderr = '', stdout = '';

        child.stderr.on('data', function(data) {
          if (process.env.DEBUG) console.log("client err:", data.toString('utf8'))
          stderr += data;
        });

        child.stdout.on('data', function(data) {
          if (process.env.DEBUG) console.log("client out:", data.toString('utf8'))
          data = data.toString('utf8');

          var matcher = client.matchers[0];
          if (matcher && matcher.regex.exec(data)) {
            if (process.env.DEBUG) console.log('client in:', matcher.answer, 'at end?', matcher.atEnd);
            if (matcher.atEnd) {
              child.stdin.end(matcher.answer + '\n');
            } else {
              child.stdin.write(matcher.answer + '\n');
            }
            client.matchers.splice(0, 1);
          }

          stdout += data;
        });

        child.on('exit', function(code) {
          release();
          delete client.child;
          if (process.env.DEBUG) console.error('Finished', args, 'with code', code);
          cb(code, stdout, stderr);
        });
      })
    });
  });
}

Client.prototype.finish = function(cb) {
  var client = this;
  setImmediate(function() {
    client.lock.acquire(function(release) {
      release();
      cb();
    })
  })
}

Client.prototype.destroy = function() {
  if (this.child) {
    process.kill(this.child.pid, 'SIGKILL');
    delete this.child;
  }
}

Client.prototype._write = function(regex, answer, atEnd) {
  this.matchers.push({regex: regex, answer: answer, atEnd: atEnd});
}