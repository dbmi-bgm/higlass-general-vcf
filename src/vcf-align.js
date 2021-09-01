class VariantAligner {
  constructor() {
    
  }

  // See segmentsToRows concerning the role of occupiedSpaceInRows
  assignSegmentToRow(segment, occupiedSpaceInRows, padding) {
    const segmentFromWithPadding = segment.from - padding;
    const segmentToWithPadding = segment.to + padding;

    // no row has been assigned - find a suitable row and update the occupied space
    if (segment.row === null || segment.row === undefined) {
      // Go through each row and look if there is space for the segment
      for (let i = 0; i < occupiedSpaceInRows.length; i++) {
        if (!occupiedSpaceInRows[i]) {
          return;
        }
        const rowSpaceFrom = occupiedSpaceInRows[i].from;
        const rowSpaceTo = occupiedSpaceInRows[i].to;
        if (segmentToWithPadding < rowSpaceFrom) {
          segment.row = i;
          occupiedSpaceInRows[i] = {
            from: segmentFromWithPadding,
            to: rowSpaceTo,
          };
          return;
        } else if (segmentFromWithPadding > rowSpaceTo) {
          segment.row = i;
          occupiedSpaceInRows[i] = {
            from: rowSpaceFrom,
            to: segmentToWithPadding,
          };
          return;
        }
      }
      // There is no space in the existing rows, so add a new one.
      segment.row = occupiedSpaceInRows.length;
      occupiedSpaceInRows.push({
        from: segmentFromWithPadding,
        to: segmentToWithPadding,
      });
    }
   
  }

  createPileup(segments) {
    const padding = 5;


    // The following array contains elements fo the form
    // occupiedSpaceInRows[i] = {from: 100, to: 110}
    // This means that in row i, the space from 100 to 110 is occupied and reads cannot be placed there
    // This array is updated with every segment that is added to the scene
    let occupiedSpaceInRows = [];
    let filteredSegments = segments.filter((x) => x.row === null);

   

    filteredSegments.sort((a, b) => a.from - b.from);
    filteredSegments.forEach((segment) => {
      this.assignSegmentToRow(segment, occupiedSpaceInRows, padding);

    });

  }

  createHorizontalAlignment(segments){
    segments.forEach((segment) => {
      segment.row = 0;
    });
  }

  alignSegments(segments, displayConfiguration){

    if('yAlignment' in displayConfiguration && displayConfiguration.yAlignment.type === "pileup"){
      this.createPileup(segments);
    }
    else{
      this.createHorizontalAlignment(segments);
    }

  }


}

export default VariantAligner;
