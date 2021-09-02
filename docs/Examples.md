# Examples

## Chromosome bands

![Cytoband](/images/cytoband.png)

Track definition:
```javascript
"displayConfiguration":{
   "mark": {
      "field": "INFO:GIESTAIN",
      "type": "nominal",
      "domain": ["acen-east", "acen-west"],
      "range": ["triangle-east", "triangle-west"],
   "default": "rect",
   "size": 16
   },
   "color": {
      "field": "INFO:GIESTAIN",
      "type": "nominal",
      "domain": ["delimiter", "acen-east", "acen-west", "stalk", "gvar", "gneg", "gpos25", "gpos50", "gpos75", "gpos100"],
      "range": ["#3ed0ed", "#FF2323", "#FF2323", "#9F9F9F", "#4F4F4F", "#EEEEEE", "#B9B9B9", "#848484", "#6A6A6A", "#4F4F4F",
      ],
      "default": "#000000"
   },
   "label": {
      "type": "contained",
      "align": "left",
      "text": "$INFO:NAME$",
      "excludes": {
         "field": "INFO:GIESTAIN",
         "values": ["acen-east", "acen-west", "delimiter"],
      },
      "color": "automatic",
      "fontSize": 13
   },
   "tooltip": {
      "field": "INFO:GIESTAIN",
      "type": "nominal",
      "domain": ["acen-east", "acen-west", "delimiter"],
      "range": [
         `<table>` +
            `<tr><td>Chromosome:</td><td>$CHROM$</td></tr>` +
            `<tr><td>Name:</td><td>$INFO:NAME$</td></tr>` +
            `<tr><td>Stain:</td><td>acen</td></tr>` +
         `<table>`,
         `<table>` +
            `<tr><td>Chromosome:</td><td>$CHROM$</td></tr>` +
            `<tr><td>Name:</td><td>$INFO:NAME$</td></tr>` +
            `<tr><td>Stain:</td><td>acen</td></tr>` +
         `<table>`,
         "Chromosome boundary"
      ],
      "default": `<table>` +
         `<tr><td>Chromosome:</td><td>$CHROM$</td></tr>` +
         `<tr><td>Name:</td><td>$INFO:NAME$</td></tr>` +
         `<tr><td>Stain:</td><td>$INFO:GIESTAIN$</td></tr>` +
         `<table>`
   },
   "xStart": {
      "field": "POS"
   },
   "xEnd": {
      "field": "INFO:END"
   },
   "yAlignment": {
      "type": "horizontal"
   }
}

```

## Structural variants

![Structural variants](/images/structural_variants.png)

Track definition:
```javascript
 "displayConfiguration":{
   "xStart": {
      "field": "POS"
   },
   "xEnd": {
      "field": "INFO:END"
   },
   "yAlignment": {
      "type": "pileup"
   },
   "mark": {
      "default": "rect",
      "size": 16
   },
   "color": {
      "field": "INFO:SVTYPE",
      "type": "nominal",
      "domain": ["DEL", "DUP"],
      "range": ["#FF0000", "#31b800"],
      "default": "#333333"
   },
   "label": {
      "type": "contained",
      "align": "left",
      "text": "$INFO:SVTYPE$, $INFO:SVLEN$ bp",
      "color": "#FFFFFF",
      "fontSize": 13
   }
}
```
