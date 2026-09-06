import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('media-proxy-sw.js', () => {
  const swPath = path.resolve(__dirname, '../../../public/media-proxy-sw.js');
  const swContent = fs.readFileSync(swPath, 'utf-8');

  it('should include cloudflow, streamflow, and medialayer in domain interception logic', () => {
    expect(swContent).toContain("url.hostname.includes('cloudflow')");
    expect(swContent).toContain("url.hostname.includes('streamflow')");
    expect(swContent).toContain("url.hostname.includes('medialayer')");
  });

  it('should intercept existing domains videobello.net, skylayer64.online, and cloudremux.online', () => {
    expect(swContent).toContain("url.hostname.includes('videobello.net')");
    expect(swContent).toContain("url.hostname.includes('skylayer64.online')");
    expect(swContent).toContain("url.hostname.includes('cloudremux.online')");
  });

  it('should not call respondWith on non-targeted requests and return early', () => {
    expect(swContent).not.toContain('event.respondWith(fetch(event.request))');
    expect(swContent).toContain('if (!shouldIntercept)');
  });
});

