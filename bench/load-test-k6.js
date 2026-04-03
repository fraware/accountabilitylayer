import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 2,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.5'],
  },
};

const base = __ENV.TARGET_URL || 'http://127.0.0.1:5000';

export default function () {
  const res = http.get(`${base}/healthz`);
  check(res, { 'healthz 2xx': (r) => r.status >= 200 && r.status < 300 });
  sleep(0.5);
}
