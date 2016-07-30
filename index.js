var moment = require("moment");
var elasticsearch = require("elasticsearch");
var AWS = require('aws-sdk');

var endpoint = process.env.ENDPOINT;
var es_region = process.env.ES_REGION;
var excludedIndices = (process.env.EXCLUDED_INDICES || '.kibana').split(/[ ,]/);
var indexDate = moment.utc().subtract(+(process.env.MAX_INDEX_AGE || 14), 'days');

exports.handler = function(event, context) {
  var myCredentials = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials 
  var client = new elasticsearch.Client({
    host: endpoint,
    connectionClass: require('http-aws-es'),
    amazonES: {
      region: es_region,
      credentials: myCredentials
    }
  });

  getIndices(client)
    .then(extractIndices)
    .then(filterIndices)
    .then(deleteIndices(client))
    .then(report(context.succeed), context.fail);
}

function getIndices(client) {
  return client.indices.getAliases();
}

function extractIndices(results) {
  return Object.keys(results);
}

function filterIndices(indices) {
  return indices.filter(function(index) {
    return !isExcluded(index) && isTooOld(index);
  });
}

function deleteIndices(client) {
  return function(indices) {
    if (indices.length > 0) {
      return client.indices.delete({index: indices}).then(function() {
        return indices;
      });
    } else {
      return indices;
    }
  };
}

function report(cb) {
  return function(indices) {
    var len = indices.length;
    if (len > 0) {
      cb('Successfully deleted ' + len + ' indices: ' + indices.join(', '));
    } else {
      cb('There were no indices to delete.');
    }
  };
}

function isExcluded(indexName) {
  return excludedIndices.indexOf(indexName) !== -1;
}

function isTooOld(indexName) {
  var m = moment.utc(indexName, 'YYYY.MM.DD');
  return m.isBefore(indexDate);
}
