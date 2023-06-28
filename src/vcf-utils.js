import {color} from 'd3-color';

export const getRgba = (c) => {
  return color(c);
}

export const isLightOrDark = (color) => {

  // Variables for red, green, blue values
  var r, g, b, hsp;
  
  // Check the format of the color, HEX or RGB?
  if (color.match(/^rgb/)) {

      // If RGB --> store the red, green, blue values in separate variables
      color = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);
      
      r = color[1];
      g = color[2];
      b = color[3];
  } 
  else {
      
      // If hex --> Convert it to RGB: http://gist.github.com/983661
      color = +("0x" + color.slice(1).replace( 
      color.length < 5 && /./g, '$&$&'));

      r = color >> 16;
      g = color >> 8 & 255;
      b = color & 255;
  }
  
  // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
  hsp = Math.sqrt(
  0.299 * (r * r) +
  0.587 * (g * g) +
  0.114 * (b * b)
  );

  // Using the HSP value, determine whether the color is light or dark
  //if (hsp>127.5) {
  if (hsp>140) {

      return 'light';
  } 
  else {

      return 'dark';
  }
}


export const vcfRecordToJson = (vcfRecord, chrName, chrOffset, displayConfiguration) => {

  //console.log(vcfRecord)
  let segment = {};

  let xStart = vcfRecord.POS + chrOffset;
  if(displayConfiguration.hasOwnProperty('xStart')){
    let providedStart = extractDataField(vcfRecord, displayConfiguration.xStart.field);
    const parsedStart = parseInt(providedStart, 10);
    if (!isNaN(parsedStart)) { 
      xStart = parsedStart + chrOffset; 
    }
  }
  

  let xEnd = xStart + 1;
  //console.log(displayConfiguration)
  if(displayConfiguration.hasOwnProperty('xEnd')){
    let providedEnd = extractDataField(vcfRecord, displayConfiguration.xEnd.field);
    
    const parsedEnd = parseInt(providedEnd, 10);
    if (!isNaN(parsedEnd)) { 
      xEnd = parsedEnd + chrOffset; 
    }
  }

  if(xEnd <= xStart){
    xEnd = xStart + 1;
  }

  let colorIndex = 0;
  let colorHex = "#000000";
  if(displayConfiguration.hasOwnProperty('color')){
    let determiningValue = extractDataField(vcfRecord, displayConfiguration.color.field);
    if(determiningValue === null){
      colorIndex = 0;
    }else{
      const i = displayConfiguration.color.domain.indexOf(determiningValue);
      if(i>=0){
        colorHex = displayConfiguration.color.range[i];
      }
      colorIndex = i >= 0 ? i+1 : 0; // 0 is the default or black
    }
  }

  let mark = "rect";
  let markSize = 12;
  if(displayConfiguration.hasOwnProperty('mark')){
    if(displayConfiguration.mark.hasOwnProperty('default')){
      mark = displayConfiguration.mark.default;
    }
    if(displayConfiguration.mark.hasOwnProperty('field')){
      let determiningValue = extractDataField(vcfRecord, displayConfiguration.mark.field);
      if(determiningValue !== null){
        const i = displayConfiguration.mark.domain.indexOf(determiningValue);
        if(i>=0){
          mark = displayConfiguration.mark.range[i];
        }
        
      }
    }
    if('size' in displayConfiguration.mark){
      markSize = parseInt(displayConfiguration.mark.size,10);
    }
  }

  let tooltip = "";
  if('tooltip' in displayConfiguration){
    let tooltipRaw = displayConfiguration.tooltip.default;
    if('field' in displayConfiguration.tooltip){
      let v = extractDataField(vcfRecord, displayConfiguration.tooltip.field);
      if(v !== null){
        const i = displayConfiguration.tooltip.domain.indexOf(v);
        if(i>=0){
          tooltipRaw = displayConfiguration.tooltip.range[i];
        }
      }
    }
    tooltip = replaceDataPathsInString(vcfRecord, tooltipRaw);
  }
  
  let label = "";
  if('label' in displayConfiguration && 'text' in displayConfiguration.label){
    let assignLabel = true;
    if('includes' in displayConfiguration.label){
      const includesField = extractDataField(vcfRecord, displayConfiguration.label.includes.field);
      if(!displayConfiguration.label.includes.values.includes(includesField)){
        assignLabel = false;
      }
    }
    else if('excludes' in displayConfiguration.label){
      const excludesField = extractDataField(vcfRecord, displayConfiguration.label.excludes.field);
      if(displayConfiguration.label.excludes.values.includes(excludesField)){
        assignLabel = false;
      }
    }
    if(assignLabel){
      label = replaceDataPathsInString(vcfRecord, displayConfiguration.label.text);
    }
    
  }

  segment = {
    id: vcfRecord['ID'][0],
    from: xStart,
    to: xEnd,
    tooltip: tooltip,
    color: colorIndex,
    colorHex: colorHex,
    mark: mark,
    markSize: markSize,
    label: label,
    row: null
  };
  //segment['svlenAbs'] = Math.abs(segment.to - segment.from);

  //console.log(vcfRecord)
  //console.log(segment)

  return segment;
};


const extractDataField = (vcfRecord, path) => {

  const pathArr = path.split(':');
  let res = vcfRecord;

  pathArr.forEach((v) => {
    if(typeof res === 'object' && res !== null && res[v] !== undefined){
      res = res[v];
    }
    else{
      res = null;
    }
  });
  return flattenTrivialArray(res);
}

const replaceDataPathsInString = (vcfRecord, str) => {

  const datapaths = [];
  
  str.split(/[$$]/).forEach((v) => {
    let data = extractDataField(vcfRecord, v);
    if(data !== null){
      if(Array.isArray(data)){
        data = data.toString();
      }
      datapaths.push({
        key: "$" + v + "$",
        value: data
      });
    }
  });
  //console.log("datapath", datapaths)
  let res = str;
  datapaths.forEach(p => {
    res = res.replace(p.key, p.value)
  })
  return res;
}

const flattenTrivialArray = (arr) => {
  if(Array.isArray(arr) && arr.length === 1){
    return arr.toString();
  }
  return arr
}