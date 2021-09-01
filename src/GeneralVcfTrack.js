import VCFDataFetcher from './vcf-fetcher';
import VariantAligner from './vcf-align';
import { spawn, BlobWorker } from 'threads';
import { vcfRecordToJson, isLightOrDark } from './vcf-utils';
import { TabixIndexedFile } from '@gmod/tabix';
import VCF from '@gmod/vcf';
import { RemoteFile } from 'generic-filehandle';
import { ChromosomeInfo, absToChr } from './chrominfo-utils';
import MyWorkerWeb from 'raw-loader!../dist/worker.js';
import sanitizeHtml from 'sanitize-html';
import hexToRgba from 'hex-to-rgba';

const createColorTexture = (PIXI, colors) => {
  const colorTexRes = Math.max(2, Math.ceil(Math.sqrt(colors.length)));

  const rgba = new Float32Array(colorTexRes ** 2 * 4);
  colors.forEach((color, i) => {
    const rgbaStr = hexToRgba(color);
    const rgbaArr = rgbaStr.substring(5, rgbaStr.length - 1).split(",").map((e)=> parseFloat(e));
    // eslint-disable-next-line prefer-destructuring
    rgba[i * 4] = rgbaArr[0]/265; // r
    // eslint-disable-next-line prefer-destructuring
    rgba[i * 4 + 1] = rgbaArr[1]/265; // g
    // eslint-disable-next-line prefer-destructuring
    rgba[i * 4 + 2] = rgbaArr[2]/265; // b
    // eslint-disable-next-line prefer-destructuring
    rgba[i * 4 + 3] = rgbaArr[3]; // a
  });

  return [PIXI.Texture.fromBuffer(rgba, colorTexRes, colorTexRes), colorTexRes];
};

function invY(p, t) {
  return (p - t.y) / t.k;
}

const scaleScalableGraphics = (graphics, xScale, drawnAtScale) => {
  const tileK =
    (drawnAtScale.domain()[1] - drawnAtScale.domain()[0]) /
    (xScale.domain()[1] - xScale.domain()[0]);
  const newRange = xScale.domain().map(drawnAtScale);

  const posOffset = newRange[0];
  graphics.scale.x = tileK;
  graphics.position.x = -posOffset * tileK;
};

function eqArr(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((val, index) => val === b[index])
  );
}

function eqSet(as, bs) {
  return as.size === bs.size && all(isIn(bs), as);
}

function all(pred, as) {
  for (var a of as) if (!pred(a)) return false;
  return true;
}

function isIn(as) {
  return function (a) {
    return as.has(a);
  };
}

const GeneralVcfTrack = (HGC, ...args) => {
  if (!new.target) {
    throw new Error(
      'Uncaught TypeError: Class constructor cannot be invoked without "new"',
    );
  }

  class GeneralVcfTrackClass extends HGC.tracks.Tiled1DPixiTrack {
    constructor(context, options) {
      const worker = spawn(BlobWorker.fromText(MyWorkerWeb));

      // this is where the threaded tile fetcher is called
      context.dataFetcher = new VCFDataFetcher(context.dataConfig, worker, HGC);
      super(context, options);
      context.dataFetcher.track = this;
      
      this.displayConfiguration = this.options.displayConfiguration;

      this.generateFonts();

      const chromInfoDataPromise = this.getChromInfoDataPromise(
        context.dataConfig.chromSizesUrl,
      );

      this.variantAligner = new VariantAligner();

      this.vcfData = [];
      this.visibleChromosomes = [];
      this.visibleChromosomesOld = [];
      this.visibleTileBounds = [0, 1];
      this.visibleTileBoundsOld = [0, 1];
      this.vcfDataPerChromosome = {};
      this.svTexts = {};
      this.svTextWidths = {};
      this.svTextHeights = {};
      this.numFilteredVariants = 0;
      this.numVisibleVariants = 0;

      this.textGraphics = new HGC.libraries.PIXI.Graphics();
      this.pForeground.addChild(this.textGraphics);

      this.labelGraphics = new HGC.libraries.PIXI.Graphics();
      this.pForeground.addChild(this.labelGraphics);

      this.vcfFile = new TabixIndexedFile({
        filehandle: new RemoteFile(context.dataConfig.vcfUrl),
        tbiFilehandle: new RemoteFile(context.dataConfig.tbiUrl),
      });
      const vcfHeader = this.vcfFile.getHeader();

      Promise.all([chromInfoDataPromise, vcfHeader]).then((values) => {
        this.chromInfo = values[0];
        this.vcfHeader = values[1];
        this.updateVisibleChromosomes(this._xScale);
        this.loadSvData();
      });

      this.worker = worker;
      this.valueScaleTransform = HGC.libraries.d3Zoom.zoomIdentity;

      this.trackId = this.id;
      this.viewId = context.viewUid;

      // we scale the entire view up until a certain point
      // at which point we redraw everything to get rid of
      // artifacts
      // this.drawnAtScale keeps track of the scale at which
      // we last rendered everything
      this.drawnAtScale = HGC.libraries.d3Scale.scaleLinear();
      this.variantsInView = [];

      // graphics for highliting reads under the cursor
      this.mouseOverGraphics = new HGC.libraries.PIXI.Graphics();
      this.loadingText = new HGC.libraries.PIXI.Text('Loading', {
        fontSize: '12px',
        fontFamily: 'Arial',
        fill: 'grey',
      });

      this.loadingText.x = 40;
      this.loadingText.y = 110;

      this.loadingText.anchor.x = 0;
      this.loadingText.anchor.y = 0;

      this.fetching = new Set();
      this.rendering = new Set();

      this.isShowGlobalMousePosition = context.isShowGlobalMousePosition;

      if (this.options.showMousePosition && !this.hideMousePosition) {
        this.hideMousePosition = HGC.utils.showMousePosition(
          this,
          this.is2d,
          this.isShowGlobalMousePosition(),
        );
      }

      

      this.pLabel.addChild(this.loadingText);
      this.setUpShaderAndTextures();
      //console.log(this)
    }

    initTile(tile) {
      // tile.bgGraphics = new HGC.libraries.PIXI.Graphics();
      // tile.graphics.addChild(tile.bgGraphics);
    }

    generateFonts(){

      let labelColor = '#333333';
      if('label' in this.displayConfiguration && 'color' in this.displayConfiguration.label && this.displayConfiguration.label.color.charAt(0) === "#"){
        labelColor = this.displayConfiguration.label.color;
      }
      let fontSize = 13*2;
      if('label' in this.displayConfiguration && 'fontSize' in this.displayConfiguration.label){
        fontSize = parseInt(this.displayConfiguration.label.fontSize,10) * 2;
      }

      // Install BitmapFont, used by BitmapText later
      HGC.libraries.PIXI.BitmapFont.from(
        'SegmentLabel',
        {
          fontFamily: 'Arial',
          fontSize: fontSize,
          fontWeight: 500,
          strokeThickness: 0,
          fill: labelColor,
        },
        { chars: HGC.libraries.PIXI.BitmapFont.ASCII },
      );

      HGC.libraries.PIXI.BitmapFont.from(
        'SegmentLabelLight',
        {
          fontFamily: 'Arial',
          fontSize: fontSize,
          fontWeight: 500,
          strokeThickness: 0,
          fill: "#FFFFFF",
        },
        { chars: HGC.libraries.PIXI.BitmapFont.ASCII },
      );

      HGC.libraries.PIXI.BitmapFont.from(
        'SegmentLabelDark',
        {
          fontFamily: 'Arial',
          fontSize: fontSize,
          fontWeight: 500,
          strokeThickness: 0,
          fill: "#333333",
        },
        { chars: HGC.libraries.PIXI.BitmapFont.ASCII },
      );

      HGC.libraries.PIXI.BitmapFont.from(
        'FilterLabel',
        {
          fontFamily: 'Arial',
          fontSize: 23,
          fontWeight: 500,
          strokeThickness: 0,
          fill: '#ffffff',
        },
        { chars: HGC.libraries.PIXI.BitmapFont.ASCII },
      );
    }

    getChromInfoDataPromise(chromSizesUrl) {
      return new Promise((resolve) => {
        ChromosomeInfo(chromSizesUrl, resolve);
      });
    }

    updateVisibleChromosomes(newXScale) {
      if (!this.chromInfo) {
        return;
      }

      this.visibleChromosomes = [];

      const chrA = absToChr(newXScale.domain()[0], this.chromInfo)[0];
      const chrB = absToChr(newXScale.domain()[1], this.chromInfo)[0];
      const chrAId = this.chromInfo.chrPositions[chrA].id;
      const chrBId = this.chromInfo.chrPositions[chrB].id;

      for (var i = chrAId; i <= chrBId; i++) {
        this.visibleChromosomes.push(this.chromInfo.cumPositions[i].chr);
      }
      
    }

    loadSvData() {
      if (!this.vcfHeader) {
        return;
      }
      if (!this.chromInfo) {
        return;
      }

      this.visibleChromosomes.forEach((chr) => {
        if (!(chr in this.vcfDataPerChromosome)) {
          this.updateLoadingText();
          this.vcfDataPerChromosome[chr] = [];
          this.loadChrVcfData(chr);
        }
      });
    }

    // This can only be called then chromInfo has loaded
    loadChrVcfData(chr) {
      const tbiVCFParser = new VCF({ header: this.vcfHeader });
      const { chromLengths, cumPositions, chrPositions } = this.chromInfo;
      this.vcfFile
        .getLines(chr, 0, chromLengths[chr], (line) => {
          const vcfRecord = tbiVCFParser.parseLine(line);
          
          const vcfJson = vcfRecordToJson(
            vcfRecord,
            chr,
            cumPositions[chrPositions[chr].id].pos,
            this.displayConfiguration
          );
          if(vcfJson){
            this.vcfDataPerChromosome[chr].push(vcfJson);
            this.vcfData.push(vcfJson);
          }
          

          
        })
        .then(() => {

          this.variantAligner.alignSegments(
            this.vcfData,
            this.displayConfiguration
          );
          this.updateLoadingText();
          this.updateExistingGraphics();
        });
    }

    getBoundsOfTile(tile) {
      // get the bounds of the tile
      const tileId = +tile.tileId.split('.')[1];
      const zoomLevel = +tile.tileId.split('.')[0]; //track.zoomLevel does not always seem to be up to date
      const tileWidth = +this.tilesetInfo.max_width / 2 ** zoomLevel;
      const tileMinX = this.tilesetInfo.min_pos[0] + tileId * tileWidth; // abs coordinates
      const tileMaxX = this.tilesetInfo.min_pos[0] + (tileId + 1) * tileWidth;

      return [tileMinX, tileMaxX];
    }

    setUpShaderAndTextures() {
     
      // This initializes all colors that are specified in the display configuration.
      // Only these colors can be used.
      // Black or default is at index 0
      //console.log(hexToRgba("#11223344"));
      const colors = [];
      if(this.displayConfiguration.hasOwnProperty('color')){
        if(this.displayConfiguration.color.hasOwnProperty('default')){
          colors.push(this.displayConfiguration.color.default);
        }
        else{
          const black = "#000000";
          colors.push(black);
        }
        this.displayConfiguration.color.range.forEach((color) => {
          colors.push(color);
        });
      }
      else{
        const black = "#000000";
        colors.push(black);
      }
      //const colors = Object.values(colorDict);

      const [colorMapTex, colorMapTexRes] = createColorTexture(
        HGC.libraries.PIXI,
        colors,
      );
      const uniforms = new HGC.libraries.PIXI.UniformGroup({
        uColorMapTex: colorMapTex,
        uColorMapTexRes: colorMapTexRes,
      });
      this.shader = HGC.libraries.PIXI.Shader.from(
        `
    attribute vec2 position;
    attribute float aColorIdx;

    uniform mat3 projectionMatrix;
    uniform mat3 translationMatrix;

    uniform sampler2D uColorMapTex;
    uniform float uColorMapTexRes;

    varying vec4 vColor;

    void main(void)
    {
        // Half a texel (i.e., pixel in texture coordinates)
        float eps = 0.5 / uColorMapTexRes;
        float colorRowIndex = floor((aColorIdx + eps) / uColorMapTexRes);
        vec2 colorTexIndex = vec2(
          (aColorIdx / uColorMapTexRes) - colorRowIndex + eps,
          (colorRowIndex / uColorMapTexRes) + eps
        );
        vColor = texture2D(uColorMapTex, colorTexIndex);

        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
    }

`,
        `
varying vec4 vColor;

    void main(void) {
        gl_FragColor = vColor;
    }
`,
        uniforms,
      );
    }

    forceRerender(){
      this.rerender(this.options, true);
    }

    rerender(options, force = false) {
      super.rerender(options);
      this.options = options;
      this.displayConfiguration = this.options.displayConfiguration;

      if (this.options.showMousePosition && !this.hideMousePosition) {
        this.hideMousePosition = HGC.utils.showMousePosition(
          this,
          this.is2d,
          this.isShowGlobalMousePosition(),
        );
      }

      if (!this.options.showMousePosition && this.hideMousePosition) {
        this.hideMousePosition();
        this.hideMousePosition = undefined;
      }

      if (
        force
      ) {
        this.generateFonts();
        // We have to recompute the row number
        this.vcfData.forEach((segment) => {
          segment.row = null;
        });
        this.variantAligner.alignSegments(
          this.vcfData,
          this.displayConfiguration
        );
        // We have to regenerate labels when segment rows change
        this.svTexts = {};
      }

      this.setUpShaderAndTextures();
      this.updateExistingGraphics();
    }

    synchronizeTilesAndGraphics() {

      if (!eqArr(this.visibleChromosomes, this.visibleChromosomesOld)) {
        // Regenerate the svData, so that we always work with the smallest possible set (performance)
        this.vcfData = [];
        this.visibleChromosomes.forEach((chr) => {
          if (chr in this.vcfDataPerChromosome) {
            this.vcfData = this.vcfData.concat(this.vcfDataPerChromosome[chr]);
          }
        });
        this.visibleChromosomesOld = this.visibleChromosomes;
      }

      // Check if the extend of the visible tiles changed. Only rerender if that's the case.
      // This improves efficient when receivedTiles and removeTiles is called within a short period of time,
      // and  the visible area actually hasn't changed. We only rerender once in this case.
      let tilesMinX = Number.MAX_SAFE_INTEGER;
      let tilesMaxX = Number.MIN_SAFE_INTEGER;
      const tileIds = Object.values(this.fetchedTiles).map((x) => x.remoteId);

      for (const tileId of tileIds) {
        const tileNumber = +tileId.split('.')[1];
        const zoomLevel = +tileId.split('.')[0]; //track.zoomLevel does not always seem to be up to date
        const tileWidth = +this.chromInfo.totalLength / 2 ** zoomLevel;
        const tileMinX = tileNumber * tileWidth; // abs coordinates
        const tileMaxX = (tileNumber + 1) * tileWidth;
        tilesMinX = Math.min(tileMinX, tilesMinX);
        tilesMaxX = Math.max(tileMaxX, tilesMaxX);
      }
      this.visibleTileBounds = [tilesMinX, tilesMaxX];

      if (
        this.visibleTileBounds[0] !== this.visibleTileBoundsOld[0] ||
        this.visibleTileBounds[1] !== this.visibleTileBoundsOld[1]
      ) {
        this.visibleTileBoundsOld = this.visibleTileBounds;
        super.synchronizeTilesAndGraphics();
      }
    }

    updateExistingGraphics() {

      this.loadingText.text = 'Rendering...';

      if (
        !eqSet(this.visibleTileIds, new Set(Object.keys(this.fetchedTiles)))
      ) {
        this.updateLoadingText();
        return;
      }

      const fetchedTileKeys = Object.keys(this.fetchedTiles);
      fetchedTileKeys.forEach((x) => {
        this.fetching.delete(x);
        this.rendering.add(x);
      });
      this.updateLoadingText();

      if (this.vcfData.length === 0) {
        return;
      }

      this.worker.then((tileFunctions) => {
        tileFunctions
          .renderSegments(
            this.visibleTileBounds,
            this._xScale.domain(),
            this._xScale.range(),
            this.options,
            this.vcfData,
          )
          .then((toRender) => {
            this.loadingText.visible = false;
            fetchedTileKeys.forEach((x) => {
              this.rendering.delete(x);
            });
            this.updateLoadingText();

            this.errorTextText = null;
            this.pBorder.clear();
            this.drawError();
            this.animate();

            this.positions = new Float32Array(toRender.positionsBuffer);
            this.colors = new Float32Array(toRender.colorsBuffer);
            this.ixs = new Int32Array(toRender.ixBuffer);

            const newGraphics = new HGC.libraries.PIXI.Graphics();

            this.variantsInView = toRender.variants;

            this.numFilteredVariants = toRender.numFilteredVariants;
            this.numVisibleVariants = toRender.numVisibleVariants;

            this.updateSegmentLabels();

            const geometry = new HGC.libraries.PIXI.Geometry().addAttribute(
              'position',
              this.positions,
              2,
            ); // x,y
            geometry.addAttribute('aColorIdx', this.colors, 1);
            geometry.addIndex(this.ixs);

            if (this.positions.length) {
              const state = new HGC.libraries.PIXI.State();
              const mesh = new HGC.libraries.PIXI.Mesh(
                geometry,
                this.shader,
                state,
              );

              newGraphics.addChild(mesh);
            }

            this.pMain.x = this.position[0];

            if (this.segmentGraphics) {
              this.pMain.removeChild(this.segmentGraphics);
            }

            this.pMain.addChild(newGraphics);
            this.segmentGraphics = newGraphics;

            // remove and add again to place on top
            this.pMain.removeChild(this.mouseOverGraphics);
            this.pMain.addChild(this.mouseOverGraphics);

            this.drawnAtScale = HGC.libraries.d3Scale
              .scaleLinear()
              .domain(toRender.xScaleDomain)
              .range(toRender.xScaleRange);

            scaleScalableGraphics(
              this.segmentGraphics,
              this._xScale,
              this.drawnAtScale,
            );

            // if somebody zoomed vertically, we want to readjust so that
            // they're still zoomed in vertically
            this.segmentGraphics.scale.y = this.valueScaleTransform.k;
            this.segmentGraphics.position.y = this.valueScaleTransform.y;

            this.draw();
            this.animate();
          });
      });
    }

    updateLoadingText() {
      this.loadingText.visible = true;
      this.loadingText.text = '';

      if (!this.tilesetInfo) {
        this.loadingText.text = 'Fetching tileset info...';
        return;
      }

      if (
        this.visibleChromosomes.length >
        Object.keys(this.vcfDataPerChromosome).length
      ) {
        this.loadingText.text = 'Loading data...';
        return;
      }

      this.loadingText.visible = false;
    }

    draw() {
      this.trackNotFoundText.text = 'Track not found.';
      this.trackNotFoundText.visible = true;
    }

    getMouseOverHtml(trackX, trackYIn) {

      if(!('tooltip' in this.displayConfiguration)){
        return;
      }

      this.mouseOverGraphics.clear();
      // Prevents 'stuck' read outlines when hovering quickly
      requestAnimationFrame(this.animate);
      const trackY = invY(trackYIn, this.valueScaleTransform);

      const filteredList = this.variantsInView.filter(
        (variant) =>
          this._xScale(variant.from) <= trackX &&
          trackX <= this._xScale(variant.to) &&
          trackY >= variant.yTop + 1 &&
          trackY <= variant.yTop + variant.markSize * this.valueScaleTransform.k + 1,
      );

      if (filteredList.length === 0) return '';

      const variant = filteredList[0];
      const variantFrom = this._xScale(variant.from);
      const variantTo = this._xScale(variant.to);

      // draw outline
      const width = variantTo - variantFrom;

      this.mouseOverGraphics.lineStyle({
        width: 1,
        color: 0,
      });
      this.mouseOverGraphics.drawRect(
        variantFrom,
        variant.yTop,
        width,
        variant.markSize * this.valueScaleTransform.k,
      );
      this.animate();

      let mouseOverHtml = variant.tooltip;
      return sanitizeHtml(mouseOverHtml);
    }

    capitalizeFirstLetter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }

    calculateZoomLevel() {
      return HGC.utils.trackUtils.calculate1DZoomLevel(
        this.tilesetInfo,
        this._xScale,
        this.maxZoom,
      );
    }

    calculateVisibleTiles() {
      const tiles = HGC.utils.trackUtils.calculate1DVisibleTiles(
        this.tilesetInfo,
        this._xScale,
      );

      for (const tile of tiles) {
        this.errorTextText = null;
        this.pBorder.clear();
        this.drawError();
        this.animate();
      }
      this.setVisibleTiles(tiles);
    }

    setPosition(newPosition) {
      super.setPosition(newPosition);

      [this.pMain.position.x, this.pMain.position.y] = this.position;
      [this.pMouseOver.position.x, this.pMouseOver.position.y] = this.position;

      [this.loadingText.x, this.loadingText.y] = newPosition;
      this.loadingText.x += 30;
    }

    movedY(dY) {
      return;
    }

    zoomedY(yPos, kMultiplier) {
      return;
    }

    zoomed(newXScale, newYScale) {
      super.zoomed(newXScale, newYScale);

      if (this.segmentGraphics) {
        scaleScalableGraphics(
          this.segmentGraphics,
          newXScale,
          this.drawnAtScale,
        );
      }

      this.updateVisibleChromosomes(this._xScale);
      //console.log(this.visibleChromosomes, this.visibleChromosomesOld);
      if (!eqArr(this.visibleChromosomes, this.visibleChromosomesOld)) {
        this.synchronizeTilesAndGraphics();
        this.updateExistingGraphics()
      }   

      this.updateSegmentLabels();
      this.loadSvData();

      this.mouseOverGraphics.clear();
      this.animate();
      requestAnimationFrame(this.animate);
    }

    updateSegmentLabels() {
      //return;
      this.textGraphics.removeChildren();
      const padding = 5;
      //console.log(this.variantsInView)


      this.variantsInView.forEach((segment) => {
        // Label either not specified or not available
        if(segment.label === ""){
          return;
        }

        const segFrom = this._xScale(segment.from);
        const segTo = this._xScale(segment.to);
        const segmentWidth = segTo - segFrom;

        // Segment too small - we can't display anything
        if (segmentWidth < 20) return;

        if (!(segment.id in this.svTexts)) {
          let fontName = 'SegmentLabel';
          if('label' in this.displayConfiguration && this.displayConfiguration.label.color === "automatic"){
            fontName = isLightOrDark(segment.colorHex) === "light" ? 'SegmentLabelDark' : 'SegmentLabelLight';
          }

          this.svTexts[segment.id] = new HGC.libraries.PIXI.BitmapText(segment.label, {
            fontName: fontName,
          });
          this.svTexts[segment.id].width = this.svTexts[segment.id].width / 2;
          this.svTexts[segment.id].height = this.svTexts[segment.id].height / 2;
          this.svTexts[segment.id].position.y =
            segment.row * (segment.markSize + 2) + 1;
        }
        const textWidth = this.svTexts[segment.id].width;

        const margin = segmentWidth - textWidth - 2 * padding;
        if (margin < 0) return;

        if(this.displayConfiguration.label.type === "contained"){
          if(this.displayConfiguration.label.align === "right"){
            if (segTo <= this.dimensions[0]) {
              this.svTexts[segment.id].position.x = segTo - textWidth - padding;
            } else if (segTo  >= this.dimensions[0]) {
              this.svTexts[segment.id].position.x = Math.max(
                this.dimensions[0] - textWidth - padding,
                segFrom + padding,
              );
            } 
          }
          else if(this.displayConfiguration.label.align === "center"){
            this.svTexts[segment.id].position.x = (segFrom + segTo - textWidth)/2;
          }
          else{
            if (segFrom >= 0) {
              this.svTexts[segment.id].position.x = segFrom + padding;
            } else if (textWidth + 2 * padding < segTo) {
              this.svTexts[segment.id].position.x = Math.max(
                padding,
                segFrom + padding,
              );
            } else {
              this.svTexts[segment.id].position.x = segTo - textWidth - padding;
            }
          }
        }
        

        let labelAlpha = 1.0;

        if (margin < 10 && margin >= 0) {
          // gracefully fade out
          const alphaScale = HGC.libraries.d3Scale
            .scaleLinear()
            .domain([2, 10])
            .range([0, 1])
            .clamp(true);
          labelAlpha = alphaScale(margin);
        }

        this.svTexts[segment.id].alpha = labelAlpha;
        this.textGraphics.addChild(this.svTexts[segment.id]);
      });
    }

    

    exportSVG() {
      let track = null;
      let base = null;

      if (super.exportSVG) {
        [base, track] = super.exportSVG();
      } else {
        base = document.createElement('g');
        track = base;
      }

      const output = document.createElement('g');
      track.appendChild(output);

      output.setAttribute(
        'transform',
        `translate(${this.pMain.position.x},${this.pMain.position.y}) scale(${this.pMain.scale.x},${this.pMain.scale.y})`,
      );

      const gSegment = document.createElement('g');

      gSegment.setAttribute(
        'transform',
        `translate(${this.segmentGraphics.position.x},${this.segmentGraphics.position.y})` +
          `scale(${this.segmentGraphics.scale.x},${this.segmentGraphics.scale.y})`,
      );

      output.appendChild(gSegment);

      if (this.segmentGraphics) {
        const b64string = HGC.services.pixiRenderer.plugins.extract.base64(
          // this.segmentGraphics, 'image/png', 1,
          this.pMain.parent.parent,
        );

        const gImage = document.createElement('g');

        gImage.setAttribute('transform', `translate(0,0)`);

        const image = document.createElement('image');
        image.setAttributeNS(
          'http://www.w3.org/1999/xlink',
          'xlink:href',
          b64string,
        );
        gImage.appendChild(image);
        gSegment.appendChild(gImage);

        // gSegment.appendChild(image);
      }

      return [base, base];
    }
  }

  return new GeneralVcfTrackClass(...args);
};

const icon =
  '<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"> <!-- Created with Method Draw - http://github.com/duopixel/Method-Draw/ --> <g> <title>background</title> <rect fill="#fff" id="canvas_background" height="18" width="18" y="-1" x="-1"/> <g display="none" overflow="visible" y="0" x="0" height="100%" width="100%" id="canvasGrid"> <rect fill="url(#gridpattern)" stroke-width="0" y="0" x="0" height="100%" width="100%"/> </g> </g> <g> <title>Layer 1</title> <rect id="svg_1" height="0.5625" width="2.99997" y="3.21586" x="1.18756" stroke-width="1.5" stroke="#999999" fill="#000"/> <rect id="svg_3" height="0.5625" width="2.99997" y="7.71582" x="6.06252" stroke-width="1.5" stroke="#999999" fill="#000"/> <rect id="svg_4" height="0.5625" width="2.99997" y="3.21586" x="1.18756" stroke-width="1.5" stroke="#999999" fill="#000"/> <rect id="svg_5" height="0.5625" width="2.99997" y="3.90336" x="11.49997" stroke-width="1.5" stroke="#f73500" fill="#000"/> <rect id="svg_6" height="0.5625" width="2.99997" y="7.40333" x="11.62497" stroke-width="1.5" stroke="#999999" fill="#000"/> <rect id="svg_7" height="0.5625" width="2.99997" y="13.90327" x="5.93752" stroke-width="1.5" stroke="#f4f40e" fill="#000"/> </g> </svg>';

  GeneralVcfTrack.config = {
  type: 'vcf',
  datatype: ['vcf'],
  orientation: '1d-horizontal',
  name: 'VCF Track',
  thumbnail: new DOMParser().parseFromString(icon, 'text/xml').documentElement,
  availableOptions: [
    'displayConfiguration',
    'showMousePosition'
  ],
  defaultOptions: {
    displayConfiguration: {
      xStart: {
        field: "POS"
      },
      yAlignment: {
        type: "horizontal"
      }
    },
    showMousePosition: false
  },
  optionsInfo: {
    
  },
};

export default GeneralVcfTrack;
