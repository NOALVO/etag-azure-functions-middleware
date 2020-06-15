const httpEtagControl = require('redis-http-etag-control');
const connectRedis = require('redis-simple-connect');

module.exports = {
  fullEtagPipelineMiddleware,
};

function fullEtagPipelineMiddleware(getResourceFunction, redisOptions) {
  return async (context) => {
    try {
      const redisClient = await connectRedis(redisOptions);
      if (!redisClient) {
        throw new Error('ETag middleware was unable to connect to Redis.');
      }
      const uri = context.req.originalUrl;

      const storedEtag = await httpEtagControl.getEtag(redisClient, uri);

      let reqEtag;
      if (context.req && context.req.headers) {
        reqEtag = context.req.headers.ETag || context.req.headers.Etag || context.req.headers.etag;
      }
      if (reqEtag === storedEtag) {
        context.res = { status: 304 };
        return;
      }

      const resourceFunc = async () => getResourceFunction(context);
      const cache = await httpEtagControl.getSetCacheIfNotExists(redisClient, uri, resourceFunc, storedEtag);

      context.res.body - cache.cached;
      context.res.headers = { 'If-None-Match': cache.etag };
    } catch (error) {
      return error;
    }
  };
}
