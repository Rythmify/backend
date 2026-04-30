// ============================================================
// middleware/metricsMiddleware.js — Records per-request metrics
// ============================================================
const {
  httpActiveRequests,
  httpErrorsTotal,
  httpRequestDuration,
  httpRequestTotal,
} = require('../utils/metrics');

function getRouteLabel(req) {
  if (req.route?.path) {
    return `${req.baseUrl || ''}${req.route.path}`;
  }

  return req.path;
}

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') {
    return next();
  }

  const activeLabels = {
    method: req.method,
    route: req.path,
  };
  const end = httpRequestDuration.startTimer();
  let activeRequestClosed = false;

  httpActiveRequests.inc(activeLabels);

  function closeActiveRequest() {
    if (activeRequestClosed) return;
    activeRequestClosed = true;
    httpActiveRequests.dec(activeLabels);
  }

  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: getRouteLabel(req),
      status_code: res.statusCode,
    };
    end(labels);
    httpRequestTotal.inc(labels);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }

    closeActiveRequest();
  });

  res.on('close', closeActiveRequest);

  next();
}

module.exports = metricsMiddleware;
