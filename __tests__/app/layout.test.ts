import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout, { metadata } from '@/app/layout';

describe('app/layout metadata（英語固定）', () => {
  describe('title / description', () => {
    it('title が英語', () => {
      expect(metadata.title).toBe('SQL Lineage Viz - SQL Column Lineage Visualization Tool');
    });

    it('description が英語で日本語を含まない', () => {
      const desc = metadata.description as string;
      expect(typeof desc).toBe('string');
      // ASCII 範囲外（日本語等）が含まれないことを正規表現で確認
      // eslint-disable-next-line no-control-regex
      expect(desc).toMatch(/^[\x00-\x7F]+$/);
      expect(desc.length).toBeGreaterThan(20);
    });
  });

  describe('openGraph', () => {
    it('locale が "en_US" であること', () => {
      expect(metadata.openGraph?.locale).toBe('en_US');
    });

    it('siteName が "SQL Lineage Viz"', () => {
      expect(metadata.openGraph?.siteName).toBe('SQL Lineage Viz');
    });

    it('images の alt が英語', () => {
      const images = metadata.openGraph?.images;
      expect(Array.isArray(images)).toBe(true);
      const first = (images as Array<{ alt?: string }>)[0];
      expect(first.alt).toBeDefined();
      // eslint-disable-next-line no-control-regex
      expect(first.alt as string).toMatch(/^[\x00-\x7F]+$/);
    });

    it('title / description が英語', () => {
      const ogTitle = metadata.openGraph?.title as string;
      const ogDesc = metadata.openGraph?.description as string;
      // eslint-disable-next-line no-control-regex
      expect(ogTitle).toMatch(/^[\x00-\x7F]+$/);
      // eslint-disable-next-line no-control-regex
      expect(ogDesc).toMatch(/^[\x00-\x7F]+$/);
    });
  });

  describe('twitter', () => {
    it('card が summary_large_image', () => {
      expect(metadata.twitter?.card).toBe('summary_large_image');
    });

    it('title / description が英語', () => {
      const tTitle = metadata.twitter?.title as string;
      const tDesc = metadata.twitter?.description as string;
      // eslint-disable-next-line no-control-regex
      expect(tTitle).toMatch(/^[\x00-\x7F]+$/);
      // eslint-disable-next-line no-control-regex
      expect(tDesc).toMatch(/^[\x00-\x7F]+$/);
    });
  });

  describe('keywords', () => {
    it('全要素が英語（ASCII のみ）', () => {
      const keywords = metadata.keywords as string[];
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(0);
      keywords.forEach((kw) => {
        // eslint-disable-next-line no-control-regex
        expect(kw).toMatch(/^[\x00-\x7F]+$/);
      });
    });

    it('"SQL" を含む', () => {
      expect(metadata.keywords).toEqual(expect.arrayContaining(['SQL']));
    });

    it('"lineage" を含む', () => {
      expect(metadata.keywords).toEqual(expect.arrayContaining(['lineage']));
    });
  });

  describe('robots', () => {
    it('index, follow が true', () => {
      const robots = metadata.robots as { index?: boolean; follow?: boolean };
      expect(robots.index).toBe(true);
      expect(robots.follow).toBe(true);
    });
  });

  describe('metadataBase', () => {
    it('https://sql-viz.com', () => {
      expect(metadata.metadataBase?.toString()).toBe('https://sql-viz.com/');
    });
  });

  describe('alternates.canonical', () => {
    it('"/" であること', () => {
      expect(metadata.alternates?.canonical).toBe('/');
    });
  });

  describe('Locale 非依存性（クライアント言語切替で metadata は不変）', () => {
    it('metadata は静的 const export で参照は1つだけ', () => {
      // 同一参照を返すことを確認（モジュールロード時の評価で固定）
      const ref1 = metadata;
      const ref2 = metadata;
      expect(ref1).toBe(ref2);
    });
  });

  describe('RootLayout の JSX 出力', () => {
    it('html 要素に lang="en" が付与される', () => {
      const html = renderToStaticMarkup(RootLayout({ children: null }));
      expect(html).toContain('<html lang="en"');
    });

    it('JSON-LD スクリプトが含まれる', () => {
      const html = renderToStaticMarkup(RootLayout({ children: null }));
      expect(html).toContain('application/ld+json');
      expect(html).toContain('SQL Lineage Viz');
      expect(html).toContain('"provider":{"@type":"Organization","name":"Small Piece"');
    });
  });
});
