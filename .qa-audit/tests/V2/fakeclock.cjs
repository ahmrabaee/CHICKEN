// QA T8 preload: controllable clock for the backend process (no app code changed).
// GET /__qaclock?set=<ISO>  -> process clock jumps to <ISO> and keeps ticking from there.
// GET /__qaclock            -> returns current fake time.
const http = require('http');
const RealDate = Date;
let offset = 0;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + offset); else super(...a); }
  static now() { return RealDate.now() + offset; }
}
FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
global.Date = FakeDate;
const origEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function (ev, req, res) {
  if (ev === 'request' && req.url && req.url.startsWith('/__qaclock')) {
    const u = new URL(req.url, 'http://x');
    const t = u.searchParams.get('set');
    if (t) offset = RealDate.parse(t) - RealDate.now();
    if (u.searchParams.get('reset')) offset = 0;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ now: new RealDate(RealDate.now() + offset).toISOString(), offset }));
    return true;
  }
  return origEmit.apply(this, arguments);
};
