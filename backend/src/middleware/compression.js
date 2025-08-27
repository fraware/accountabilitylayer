const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotliCompress = promisify(zlib.brotliCompress);

class CompressionMiddleware {
  constructor(options = {}) {
    this.threshold = options.threshold || 1024; // Only compress responses > 1KB
    this.level = options.level || 6; // Compression level (1-9)
    this.enabled = options.enabled !== false;
  }

  async compress(data, encoding) {
    if (!this.enabled || !data || data.length < this.threshold) {
      return { data, encoding: null };
    }

    try {
      let compressedData;
      let contentType;

      switch (encoding) {
        case 'br':
          compressedData = await brotliCompress(data, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: this.level,
              [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_GENERIC
            }
          });
          contentType = 'br';
          break;

        case 'gzip':
          compressedData = await gzip(data, { level: this.level });
          contentType = 'gzip';
          break;

        case 'deflate':
          compressedData = await deflate(data, { level: this.level });
          contentType = 'deflate';
          break;

        default:
          // Auto-detect best compression
          const [gzipResult, brotliResult] = await Promise.all([
            gzip(data, { level: this.level }),
            brotliCompress(data, {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: this.level
              }
            })
          ]);

          // Choose the smaller result
          if (brotliResult.length < gzipResult.length) {
            compressedData = brotliResult;
            contentType = 'br';
          } else {
            compressedData = gzipResult;
            contentType = 'gzip';
          }
      }

      return {
        data: compressedData,
        encoding: contentType,
        originalSize: data.length,
        compressedSize: compressedData.length,
        ratio: ((data.length - compressedData.length) / data.length * 100).toFixed(2)
      };

    } catch (error) {
      console.warn('Compression failed, returning uncompressed data:', error.message);
      return { data, encoding: null };
    }
  }

  middleware() {
    return async (req, res, next) => {
      if (!this.enabled) {
        return next();
      }

      // Store original send method
      const originalSend = res.send;
      const originalJson = res.json;

      // Override send method to add compression
      res.send = async function(data) {
        if (typeof data === 'string' || Buffer.isBuffer(data)) {
          const acceptEncoding = req.headers['accept-encoding'] || '';
          let preferredEncoding = null;

          // Determine preferred encoding
          if (acceptEncoding.includes('br')) {
            preferredEncoding = 'br';
          } else if (acceptEncoding.includes('gzip')) {
            preferredEncoding = 'gzip';
          } else if (acceptEncoding.includes('deflate')) {
            preferredEncoding = 'deflate';
          }

          if (preferredEncoding) {
            const compressionResult = await this.compress(data, preferredEncoding);
            
            if (compressionResult.encoding) {
              res.set('Content-Encoding', compressionResult.encoding);
              res.set('Content-Length', compressionResult.compressedSize);
              res.set('X-Compression-Ratio', `${compressionResult.ratio}%`);
              res.set('X-Original-Size', compressionResult.originalSize);
              
              // Log compression stats
              console.log(`Compression: ${compressionResult.originalSize}B → ${compressionResult.compressedSize}B (${compressionResult.ratio}% reduction)`);
              
              return originalSend.call(this, compressionResult.data);
            }
          }
        }

        return originalSend.call(this, data);
      }.bind(this);

      // Override json method to add compression
      res.json = async function(data) {
        const jsonString = JSON.stringify(data);
        const acceptEncoding = req.headers['accept-encoding'] || '';
        let preferredEncoding = null;

        // Determine preferred encoding
        if (acceptEncoding.includes('br')) {
          preferredEncoding = 'br';
        } else if (acceptEncoding.includes('gzip')) {
          preferredEncoding = 'gzip';
        } else if (acceptEncoding.includes('deflate')) {
          preferredEncoding = 'deflate';
        }

        if (preferredEncoding) {
          const compressionResult = await this.compress(jsonString, preferredEncoding);
          
          if (compressionResult.encoding) {
            res.set('Content-Type', 'application/json');
            res.set('Content-Encoding', compressionResult.encoding);
            res.set('Content-Length', compressionResult.compressedSize);
            res.set('X-Compression-Ratio', `${compressionResult.ratio}%`);
            res.set('X-Original-Size', compressionResult.originalSize);
            
            // Log compression stats
            console.log(`JSON Compression: ${compressionResult.originalSize}B → ${compressionResult.compressedSize}B (${compressionResult.ratio}% reduction)`);
            
            return originalSend.call(this, compressionResult.data);
          }
        }

        return originalJson.call(this, data);
      }.bind(this);

      next();
    };
  }

  // Utility method to compress data outside of middleware
  async compressData(data, encoding = 'auto') {
    return this.compress(data, encoding);
  }

  // Get compression statistics
  getStats() {
    return {
      enabled: this.enabled,
      threshold: this.threshold,
      level: this.level,
      supportedEncodings: ['br', 'gzip', 'deflate']
    };
  }
}

module.exports = CompressionMiddleware;
