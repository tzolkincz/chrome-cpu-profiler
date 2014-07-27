var profiler = require('cpu-profiler')
  , clone = require('lodash.clone')
  , fs = require('fs')
  , timings = {}

function profile(item) {
  var samples = generateSamples(item);
  var data = clone(item.topRoot)
  followChild(item.topRoot, data)

  if (!item.startTime || !item.endTime) {
    // Fallback to imitate start and end times
    var now = Date.now()
    item.startTime = now
    item.endTime = now + item.topRoot.totalTime
  }

  function gatherSamples(item) {
    var itemId = 0
    var samples = []

    function gatherSamplesInternal(item) {
      if (!item.id) {
        itemId++
        item.id = itemId
      }

      if (item.selfSamplesCount) {
        for (var i=0; i < item.selfSamplesCount; i++) {
          samples.push(itemId)
        }
      }

      if (item.childrenCount) {
        item.children.forEach(gatherSamplesInternal)
      }
    }

    gatherSamplesInternal(item)
    return samples
  }

  if (!samples || !samples.length) {
    // Fallback to restore samples array indirectly
    samples = gatherSamples(data)
  }

  return { head: data
    , startTime: formatV8Time(item.startTime)
    , endTime: formatV8Time(item.endTime)
    , samples: samples
  }
}

function formatV8Time (time) {
  return time / 1000000
}

function generateSamples(profile) {
  var samples = []
    , count = profile.samplesCount

  for (var i = 0; i < count; i++) {
    samples[i] = profile.getSample(i).id
  }

  return samples
}

function followChild(source, dest) {
  // Display url with path
  dest.url = dest.scriptName.replace(source.rootPath, '')
  // New chrome wants a hit count, this add backwards compatibility
  // hopefully these are the same
  if (typeof dest.hitCount === 'undefined')
    dest.hitCount = dest.selfSamplesCount

  // Mocking as not provided?
  // if (typeof dest.sourceId === 'undefined')
  //   dest.sourceId = 0

  // Sometimes we can have children count of zero so lets add no children
  // so flame graph works
  if (!dest.children)
    dest.children = []

  // If the node has children then continue
  if (source.childrenCount > 0) {
    for (var i = 0; i < source.childrenCount; i++) {
      var child = source.getChild(i)
        , newChild = clone(child)

      followChild(child, newChild)
      dest.children.push(newChild)
    }
  }
}

// Wrap start profiling to grab current time
profile.startProfiling = function (name) {
  // true to record samples
  return profiler.startProfiling(name, true)
}

// Wrap stop profiling to format before returning
profile.stopProfiling = function (name) {
  var data = profile(profiler.stopProfiling(name))
  if (timings[name]) {
    delete timings[name]
  }
  return data
}

profile.writeFile = function (file, data, cb) {
  if (!cb) {
    cb = function () {}
  }
  if (file !== 'string') {
    data = file
    file = false
  }
  if (typeof data === 'object') {
    data = JSON.stringify(data)
  }
  fs.writeFile(file || 'CPU-' + Date.now() + '.cpuprofile', data, cb)
}

module.exports = profile