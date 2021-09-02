# Display configuration

The visualization of a VCF file can be controlled via the `displayConfiguration` option, i.e.,
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

## Referring to VCF data

In the definitions and examples below, the value of the `field` property can refer to a column or value in the VCF file. Example:
```
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
chr1	0	0	.	.	.	.	END=2300000;NAME=p36.33;GIESTAIN=gneg
chr1	2300000	1	.	.	.	.	END=5300000;NAME=p36.32;GIESTAIN=gpos25
```
`POS` in our display configuration will refer to `0` for the first segment and `2300000` for the second segment. Similarly, `INFO:NAME` will refer to `p36.33` and `p36.32`.

If the VCF file contains samples, e.g.,
```
#CHROM	POS	ID	REF	ALT	QUAL	FILTER  INFO    FORMAT  MySample
chr1	1656917	MANTA1	T	DUP	78	PASS	END=1722387;SVTYPE=DUP;SVLEN=65470;CIEND=-610,610   GT:FT	0/1:PASS
```
then `SAMPLES:MySample:GT` will refer to `0/1`.

In general, descriptive strings (like for tooltips or labels) can refer to data in the VCF file. E.g., the string `Genotype: $SAMPLES:MySample:GT$` in the display configuration will be replaced by `Genotype: 0/1` in the visualization.


## Horizontal alignment

By defining `xStart` and `xEnd`, you can control where on the x axis (genomic axis) the data is visualized.
```javascript
"displayConfiguration":{
    "xStart": {
        "field": "POS"
    },
    "xEnd": {
        "field": "INFO:END"
    },
}
```
`xStart` defaults to the value in the `POS` column of the VCF file. The start position of the segment is then given by `CHROM:POS`. `xEnd` is optional and defaults to `POS+1`, i.e., if `xEnd` is omitted, a rectangle (or other mark) is drawn from `CHROM:POS` to `CHROM:POS+1`. In the example above `xEnd` is set to the value `END` in the `INFO` column of the VCF file. Thus, a rectangle from `CHROM:POS` to `CHROM:(INFO:END)` will be drawn. Note, that the `field` property can point to any integer value in the VCF file, that represents a genomic location in the chromosome of that segment.

## Vertical alignment

The vertical alignment can be controlled via `yAlignment`.
```javascript
"yAlignment": {
    "type": "horizontal"
}
```
Currently `horizontal` and `pileup` is supported.

## Marks

Visual marks can be controlled with the `marks` object. Minimally, it has the form

```javascript
"mark": {
    "default": "rect",
    "size": 16
}
```
Currently `rect`, `triangle-north`, `triangle-south`, `triangle-west`, `triangle-east` are supported mark types. Marks can dynamically change based on the underlying data. In the example below a triangle is displayed when the `GIESTAIN` value in the `INFO` column is `acen` or `stalk`. In all other cases a rectangle is shown.

```javascript
"mark": {
    "field": "INFO:GIESTAIN",
    "type": "nominal",
    "domain": ["acen", "stalk"],
    "range": ["triangle-east", "triangle-west"],
    "default": "rect",
    "size": 16
}
```

## Colors

The colors of different marks can be controlled with the `colors` object. Minimally, it has the form
```javascript
"color": {
    "default": "#ff0000"
}
```
which will color all marks red. A more nuanced coloring scheme based on the underlying data can be achieved with, e.g.,

```javascript
"color": {
    "field": "INFO:GIESTAIN",
    "type": "nominal",
    "domain": ["stalk", "gvar", "gneg", "gpos25", "gpos50", "gpos75", "gpos100"],
    "range": ["#9F9F9F", "#4F4F4F", "#EEEEEE", "#B9B9B9", "#848484", "#6A6A6A", "#4F4F4F"],
    "default": "#000000"
}
```
This will color the segments depending on the value of `GIESTAIN`. Values of `GIESTAIN` that are not in the `color.domain` list are colored with black.


## Labels

Individual segments can be labeled with data from the VCF file. These labels pan and zoom with the segment.

```javascript
"label": {
    "type": "contained",
    "align": "left",
    "text": "Name: $INFO:NAME$",
    "excludes": {
        "field": "INFO:GIESTAIN",
        "values": ["acen", "stalk"],
    },
    "color": "automatic",
    "fontSize": 13
}
```
In this example each segment is labeled with `Name: $INFO:NAME$`, where `$INFO:NAME$` is replaced with the corresponding data from the VCF file. Segments with `GIESTAIN` values `acen` or `stalk` are not labeled.

| Property | Description |
|---|---|
| `type` | Only `contained` is supported, which places the label inside the segment |
| `align` | `left`, `right` or `center` |
| `text` | Label text. Enclose VCF data in `$` signs |
| `excludes` | Remove label for certain segments |
| `color` | HEX value or `automatic`. `automatic` uses a light or dark color based on the underlying mark color |
| `fontSize` | Controls the label size |

## Tooltips

Tooltips appear when hovering over a mark/segment. They can be controlled using the `tooltip` object. Tooltips can be dependent on a value in the VCF file. In the example below we should different tooltips based on the value of `GIESTAIN`. Toolstip definitions can be text or HTML. As before `$...$` are replaced with the data in the VCF file.
```javascript
"tooltip": {
    "field": "INFO:GIESTAIN",
    "type": "nominal",
    "domain": ["acen", "delimiter"],
    "range": [
        `<table>` +
            `<tr><td>Chromosome:</td><td>$CHROM$</td></tr>` +
            `<tr><td>Name:</td><td>$INFO:NAME$</td></tr>` +
            `<tr><td>Stain:</td><td>Centromeric region</td></tr>` +
        `<table>`,
        "Chromosome boundary"
    ],
    "default": `<table>` +
                    `<tr><td>Chromosome:</td><td>$CHROM$</td></tr>` +
                    `<tr><td>Name:</td><td>$INFO:NAME$</td></tr>` +
                    `<tr><td>Stain:</td><td>$INFO:GIESTAIN$</td></tr>` +
                `<table>`
}
```