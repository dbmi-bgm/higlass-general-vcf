# Installation & Usage

## Local installation

The VCF track can be installed locally with `npm`:
```
npm install higlass-general-vcf
```

## Usage

The live script can be found at:

- https://unpkg.com/higlass-general-vcf/dist/higlass-general-vcf.min.js


### Client

Load this track before the HiGlass core script. For example:

```html
<script src="https://unpkg.com/higlass-general-vcf/dist/higlass-general-vcf.min.js"></script>
<script src="hglib.js"></script>
```

### Track configuration

The basic track configuration is a follows
```javascript
{
   "uid": "your-track-id",
   "type": "vcf",
   "data": {
      "type": "vcf",
      "vcfUrl": "https://url_to_file.vcf.gz",
      "tbiUrl": "https://url_to_file.vcf.gz.tbi",
      "chromSizesUrl": "https://url_to_chromsizes.txt",
   },
   "options": {
      "displayConfiguration":{
         ...
      }
   },
   "width": 500,
   "height": 150,
}
```
The VCF track uses client side data loading - no Higlass server required. Your VCF and corresponding index file must be accessible from the web. Possible display configurations are described in the next section. If you don't specify a display configuration, the track will show a black rectangle for each line in your VCF at position POS. The rectangles will be aligned horizonally and each one will be 1 bp wide.


### ECMAScript Modules (ESM)

We also build out ES modules for usage by applications who may need to import or use `higlass-general-vcf` as a component.

Whenever there is a statement such as the following, assuming `higlass-general-vcf` is in your node_modules folder:
```javascript
import { GeneralVcfTrack } from 'higlass-general-vcf';
```

Then GeneralVcfTrack would automatically be imported from the `./es` directory (set via package.json's `"module"` value). 


## Development

### Installation

```bash
$ git clone https://github.com/dbmi-bgm/higlass-general-vcf.git
$ cd higlass-general-vcf
$ npm install
```
If you have a local copy of higlass, you can then run this command in the higlass-general-vcf directory:

```bash
npm link higlass
```

### Commands

 - **Developmental server**: `npm start`
 - **Production build**: `npm run build`


