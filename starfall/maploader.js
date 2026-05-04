'use strict';
const MapLoader = (() => {
  // Returns the ordered array of {col,row} path cells from START → END.
  // Uses a simple walk: from the current cell, find the neighbour that is
  // PATH or END and hasn't been visited yet. Throws if the path is broken.
  function getPathSequence(tiles, cols, rows) {
    const C = Config.CELL;

    // Find start cell
    let startCol = -1, startRow = -1;
    outer: for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (tiles[r][c] === C.START) { startCol = c; startRow = r; break outer; }
      }
    }
    if (startCol === -1) throw new Error('MapLoader: no START cell found');

    const visited = new Set();
    const sequence = [];
    let col = startCol, row = startRow;

    while (true) {
      const key = `${col},${row}`;
      if (visited.has(key)) throw new Error(`MapLoader: path loop detected at ${key}`);
      visited.add(key);
      sequence.push({ col, row });

      const cell = tiles[row][col];
      if (cell === C.END) break;

      const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
      let moved = false;
      for (const [dc, dr] of dirs) {
        const nc = col+dc, nr = row+dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const nKey = `${nc},${nr}`;
        if (visited.has(nKey)) continue;
        const nCell = tiles[nr][nc];
        if (nCell === C.PATH || nCell === C.END) {
          col = nc; row = nr; moved = true; break;
        }
      }
      if (!moved) throw new Error(`MapLoader: path broken at col=${col} row=${row}`);
    }

    return sequence;
  }

  // Returns Set of "col,row" strings for quick lookup of buildable cells.
  // A cell is buildable if it is EMPTY (not path, start, or end).
  function getBuildableCells(tiles, cols, rows) {
    const C = Config.CELL;
    const buildable = new Set();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (tiles[r][c] === C.EMPTY) buildable.add(`${c},${r}`);
      }
    }
    return buildable;
  }

  // Returns {col, row} of the START cell.
  function getStart(tiles, cols, rows) {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (tiles[r][c] === Config.CELL.START) return { col: c, row: r };
    return null;
  }

  // Returns {col, row} of the END cell.
  function getEnd(tiles, cols, rows) {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (tiles[r][c] === Config.CELL.END) return { col: c, row: r };
    return null;
  }

  // Validates a tile array is well-formed: rectangular, only known cell values.
  function validate(tiles, cols, rows) {
    const known = new Set(Object.values(Config.CELL));
    const errors = [];
    if (tiles.length !== rows) errors.push(`expected ${rows} rows, got ${tiles.length}`);
    for (let r = 0; r < tiles.length; r++) {
      if (tiles[r].length !== cols) errors.push(`row ${r}: expected ${cols} cols, got ${tiles[r].length}`);
      for (let c = 0; c < tiles[r].length; c++) {
        if (!known.has(tiles[r][c])) errors.push(`unknown cell value ${tiles[r][c]} at (${c},${r})`);
      }
    }
    return errors;
  }

  return { getPathSequence, getBuildableCells, getStart, getEnd, validate };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   GAME STATE
   Single source of truth. All mutation goes through named methods.
   ═══════════════════════════════════════════════════════════════════════════ */
