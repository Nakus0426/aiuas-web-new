import {
	CustomHeightmapTerrainProvider,
	defaultValue,
	Ellipsoid,
	defined,
	DeveloperError,
	HeightmapTerrainData,
	Resource,
	Rectangle,
	TileAvailability,
	Color,
	LabelStyle,
	Cartesian2,
	HorizontalOrigin,
	VerticalOrigin,
	Cartesian3,
	combine,
	createGuid,
	Math as Math$1,
	Entity,
	SceneTransforms,
} from 'cesium'

var commonjsGlobal =
	typeof globalThis !== 'undefined'
		? globalThis
		: typeof window !== 'undefined'
			? window
			: typeof global !== 'undefined'
				? global
				: typeof self !== 'undefined'
					? self
					: {}

var inflate$2 = {}

// Note: adler32 takes 12% for level 0 and 2% for level 6.
// It isn't worth it to make additional optimizations as in original.
// Small size is preferable.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const adler32$1 = (adler, buf, len, pos) => {
	let s1 = (adler & 0xffff) | 0,
		s2 = ((adler >>> 16) & 0xffff) | 0,
		n = 0
	while (len !== 0) {
		// Set limit ~ twice less than 5552, to keep
		// s2 in 31-bits, because we force signed ints.
		// in other case %= will fail.
		n = len > 2000 ? 2000 : len
		len -= n
		do {
			s1 = (s1 + buf[pos++]) | 0
			s2 = (s2 + s1) | 0
		} while (--n)
		s1 %= 65521
		s2 %= 65521
	}
	return s1 | (s2 << 16) | 0
}
var adler32_1 = adler32$1

// Note: we can't get significant speed boost here.
// So write code to minimize size - no pregenerated tables
// and array tools dependencies.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// Use ordinary array, since untyped makes no boost here
const makeTable = () => {
	let c,
		table = []
	for (var n = 0; n < 256; n++) {
		c = n
		for (var k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
		}
		table[n] = c
	}
	return table
}

// Create table on load. Just 255 signed longs. Not a problem.
const crcTable = new Uint32Array(makeTable())
const crc32$1 = (crc, buf, len, pos) => {
	const t = crcTable
	const end = pos + len
	crc ^= -1
	for (let i = pos; i < end; i++) {
		crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xff]
	}
	return crc ^ -1 // >>> 0;
}
var crc32_1 = crc32$1

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// See state defs from inflate.js
const BAD$1 = 16209 /* got a data error -- remain here until reset */
const TYPE$1 = 16191 /* i: waiting for type bits, including last-flag bit */

/*
   Decode literal, length, and distance codes and write out the resulting
   literal and match bytes until either not enough input or output is
   available, an end-of-block is encountered, or a data error is encountered.
   When large enough input and output buffers are supplied to inflate(), for
   example, a 16K input buffer and a 64K output buffer, more than 95% of the
   inflate execution time is spent in this routine.

   Entry assumptions:

        state.mode === LEN
        strm.avail_in >= 6
        strm.avail_out >= 258
        start >= strm.avail_out
        state.bits < 8

   On return, state.mode is one of:

        LEN -- ran out of enough output space or enough available input
        TYPE -- reached end of block code, inflate() to interpret next block
        BAD -- error in block data

   Notes:

    - The maximum input bits used by a length/distance pair is 15 bits for the
      length code, 5 bits for the length extra, 15 bits for the distance code,
      and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
      Therefore if strm.avail_in >= 6, then there is enough input to avoid
      checking for available input while decoding.

    - The maximum bytes that a single length/distance pair can output is 258
      bytes, which is the maximum length that can be coded.  inflate_fast()
      requires strm.avail_out >= 258 for each loop to avoid checking for
      output space.
 */
var inffast = function inflate_fast(strm, start) {
	let _in /* local strm.input */
	let last /* have enough input while in < last */
	let _out /* local strm.output */
	let beg /* inflate()'s initial strm.output */
	let end /* while out < end, enough space available */
	//#ifdef INFLATE_STRICT
	let dmax /* maximum distance from zlib header */
	//#endif
	let wsize /* window size or zero if not using window */
	let whave /* valid bytes in the window */
	let wnext /* window write index */
	// Use `s_window` instead `window`, avoid conflict with instrumentation tools
	let s_window /* allocated sliding window, if wsize != 0 */
	let hold /* local strm.hold */
	let bits /* local strm.bits */
	let lcode /* local strm.lencode */
	let dcode /* local strm.distcode */
	let lmask /* mask for first level of length codes */
	let dmask /* mask for first level of distance codes */
	let here /* retrieved table entry */
	let op /* code bits, operation, extra bits, or */
	/*  window position, window bytes to copy */
	let len /* match length, unused bytes */
	let dist /* match distance */
	let from /* where to copy match from */
	let from_source
	let input, output // JS specific, because we have no pointers

	/* copy state to local variables */
	const state = strm.state
	//here = state.here;
	_in = strm.next_in
	input = strm.input
	last = _in + (strm.avail_in - 5)
	_out = strm.next_out
	output = strm.output
	beg = _out - (start - strm.avail_out)
	end = _out + (strm.avail_out - 257)
	//#ifdef INFLATE_STRICT
	dmax = state.dmax
	//#endif
	wsize = state.wsize
	whave = state.whave
	wnext = state.wnext
	s_window = state.window
	hold = state.hold
	bits = state.bits
	lcode = state.lencode
	dcode = state.distcode
	lmask = (1 << state.lenbits) - 1
	dmask = (1 << state.distbits) - 1

	/* decode literals and length/distances until end-of-block or not enough
     input data or output space */

	top: do {
		if (bits < 15) {
			hold += input[_in++] << bits
			bits += 8
			hold += input[_in++] << bits
			bits += 8
		}
		here = lcode[hold & lmask]
		dolen: for (;;) {
			// Goto emulation
			op = here >>> 24 /*here.bits*/
			hold >>>= op
			bits -= op
			op = (here >>> 16) & 0xff /*here.op*/
			if (op === 0) {
				/* literal */
				//Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
				//        "inflate:         literal '%c'\n" :
				//        "inflate:         literal 0x%02x\n", here.val));
				output[_out++] = here & 0xffff /*here.val*/
			} else if (op & 16) {
				/* length base */
				len = here & 0xffff /*here.val*/
				op &= 15 /* number of extra bits */
				if (op) {
					if (bits < op) {
						hold += input[_in++] << bits
						bits += 8
					}
					len += hold & ((1 << op) - 1)
					hold >>>= op
					bits -= op
				}
				//Tracevv((stderr, "inflate:         length %u\n", len));
				if (bits < 15) {
					hold += input[_in++] << bits
					bits += 8
					hold += input[_in++] << bits
					bits += 8
				}
				here = dcode[hold & dmask]
				dodist: for (;;) {
					// goto emulation
					op = here >>> 24 /*here.bits*/
					hold >>>= op
					bits -= op
					op = (here >>> 16) & 0xff /*here.op*/
					if (op & 16) {
						/* distance base */
						dist = here & 0xffff /*here.val*/
						op &= 15 /* number of extra bits */
						if (bits < op) {
							hold += input[_in++] << bits
							bits += 8
							if (bits < op) {
								hold += input[_in++] << bits
								bits += 8
							}
						}
						dist += hold & ((1 << op) - 1)
						//#ifdef INFLATE_STRICT
						if (dist > dmax) {
							strm.msg = 'invalid distance too far back'
							state.mode = BAD$1
							break top
						}
						//#endif
						hold >>>= op
						bits -= op
						//Tracevv((stderr, "inflate:         distance %u\n", dist));
						op = _out - beg /* max distance in output */
						if (dist > op) {
							/* see if copy from window */
							op = dist - op /* distance back in window */
							if (op > whave) {
								if (state.sane) {
									strm.msg = 'invalid distance too far back'
									state.mode = BAD$1
									break top
								}

								// (!) This block is disabled in zlib defaults,
								// don't enable it for binary compatibility
								//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
								//                if (len <= op - whave) {
								//                  do {
								//                    output[_out++] = 0;
								//                  } while (--len);
								//                  continue top;
								//                }
								//                len -= op - whave;
								//                do {
								//                  output[_out++] = 0;
								//                } while (--op > whave);
								//                if (op === 0) {
								//                  from = _out - dist;
								//                  do {
								//                    output[_out++] = output[from++];
								//                  } while (--len);
								//                  continue top;
								//                }
								//#endif
							}
							from = 0 // window index
							from_source = s_window
							if (wnext === 0) {
								/* very common case */
								from += wsize - op
								if (op < len) {
									/* some from window */
									len -= op
									do {
										output[_out++] = s_window[from++]
									} while (--op)
									from = _out - dist /* rest from output */
									from_source = output
								}
							} else if (wnext < op) {
								/* wrap around window */
								from += wsize + wnext - op
								op -= wnext
								if (op < len) {
									/* some from end of window */
									len -= op
									do {
										output[_out++] = s_window[from++]
									} while (--op)
									from = 0
									if (wnext < len) {
										/* some from start of window */
										op = wnext
										len -= op
										do {
											output[_out++] = s_window[from++]
										} while (--op)
										from = _out - dist /* rest from output */
										from_source = output
									}
								}
							} else {
								/* contiguous in window */
								from += wnext - op
								if (op < len) {
									/* some from window */
									len -= op
									do {
										output[_out++] = s_window[from++]
									} while (--op)
									from = _out - dist /* rest from output */
									from_source = output
								}
							}
							while (len > 2) {
								output[_out++] = from_source[from++]
								output[_out++] = from_source[from++]
								output[_out++] = from_source[from++]
								len -= 3
							}
							if (len) {
								output[_out++] = from_source[from++]
								if (len > 1) {
									output[_out++] = from_source[from++]
								}
							}
						} else {
							from = _out - dist /* copy direct from output */
							do {
								/* minimum length is three */
								output[_out++] = output[from++]
								output[_out++] = output[from++]
								output[_out++] = output[from++]
								len -= 3
							} while (len > 2)
							if (len) {
								output[_out++] = output[from++]
								if (len > 1) {
									output[_out++] = output[from++]
								}
							}
						}
					} else if ((op & 64) === 0) {
						/* 2nd level distance code */
						here = dcode[(here & 0xffff) /*here.val*/ + (hold & ((1 << op) - 1))]
						continue dodist
					} else {
						strm.msg = 'invalid distance code'
						state.mode = BAD$1
						break top
					}
					break // need to emulate goto via "continue"
				}
			} else if ((op & 64) === 0) {
				/* 2nd level length code */
				here = lcode[(here & 0xffff) /*here.val*/ + (hold & ((1 << op) - 1))]
				continue dolen
			} else if (op & 32) {
				/* end-of-block */
				//Tracevv((stderr, "inflate:         end of block\n"));
				state.mode = TYPE$1
				break top
			} else {
				strm.msg = 'invalid literal/length code'
				state.mode = BAD$1
				break top
			}
			break // need to emulate goto via "continue"
		}
	} while (_in < last && _out < end)

	/* return unused bytes (on entry, bits < 8, so in won't go too far back) */
	len = bits >> 3
	_in -= len
	bits -= len << 3
	hold &= (1 << bits) - 1

	/* update state and return */
	strm.next_in = _in
	strm.next_out = _out
	strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last)
	strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end)
	state.hold = hold
	state.bits = bits
	return
}

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const MAXBITS = 15
const ENOUGH_LENS$1 = 852
const ENOUGH_DISTS$1 = 592
//const ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

const CODES$1 = 0
const LENS$1 = 1
const DISTS$1 = 2
const lbase = new Uint16Array([
	/* Length codes 257..285 base */ 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99,
	115, 131, 163, 195, 227, 258, 0, 0,
])
const lext = new Uint8Array([
	/* Length codes 257..285 extra */ 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20,
	20, 20, 20, 21, 21, 21, 21, 16, 72, 78,
])
const dbase = new Uint16Array([
	/* Distance codes 0..29 base */ 1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025,
	1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0,
])
const dext = new Uint8Array([
	/* Distance codes 0..29 extra */ 16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25,
	25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64,
])
const inflate_table$1 = (type, lens, lens_index, codes, table, table_index, work, opts) => {
	const bits = opts.bits
	//here = opts.here; /* table entry for duplication */

	let len = 0 /* a code's length in bits */
	let sym = 0 /* index of code symbols */
	let min = 0,
		max = 0 /* minimum and maximum code lengths */
	let root = 0 /* number of index bits for root table */
	let curr = 0 /* number of index bits for current table */
	let drop = 0 /* code bits to drop for sub-table */
	let left = 0 /* number of prefix codes available */
	let used = 0 /* code entries in table used */
	let huff = 0 /* Huffman code */
	let incr /* for incrementing code, index */
	let fill /* index for replicating entries */
	let low /* low bits for current root entry */
	let mask /* mask for low root bits */
	let next /* next available space in table */
	let base = null /* base value table to use */
	//  let shoextra;    /* extra bits table to use */
	let match /* use base and extra for symbol >= match */
	const count = new Uint16Array(MAXBITS + 1) //[MAXBITS+1];    /* number of codes of each length */
	const offs = new Uint16Array(MAXBITS + 1) //[MAXBITS+1];     /* offsets in table for each length */
	let extra = null
	let here_bits, here_op, here_val

	/*
   Process a set of code lengths to create a canonical Huffman code.  The
   code lengths are lens[0..codes-1].  Each length corresponds to the
   symbols 0..codes-1.  The Huffman code is generated by first sorting the
   symbols by length from short to long, and retaining the symbol order
   for codes with equal lengths.  Then the code starts with all zero bits
   for the first code of the shortest length, and the codes are integer
   increments for the same length, and zeros are appended as the length
   increases.  For the deflate format, these bits are stored backwards
   from their more natural integer increment ordering, and so when the
   decoding tables are built in the large loop below, the integer codes
   are incremented backwards.
    This routine assumes, but does not check, that all of the entries in
   lens[] are in the range 0..MAXBITS.  The caller must assure this.
   1..MAXBITS is interpreted as that code length.  zero means that that
   symbol does not occur in this code.
    The codes are sorted by computing a count of codes for each length,
   creating from that a table of starting indices for each length in the
   sorted table, and then entering the symbols in order in the sorted
   table.  The sorted table is work[], with that space being provided by
   the caller.
    The length counts are used for other purposes as well, i.e. finding
   the minimum and maximum length codes, determining if there are any
   codes at all, checking for a valid set of lengths, and looking ahead
   at length counts to determine sub-table sizes when building the
   decoding tables.
   */

	/* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
	for (len = 0; len <= MAXBITS; len++) {
		count[len] = 0
	}
	for (sym = 0; sym < codes; sym++) {
		count[lens[lens_index + sym]]++
	}

	/* bound code lengths, force root to be within code lengths */
	root = bits
	for (max = MAXBITS; max >= 1; max--) {
		if (count[max] !== 0) {
			break
		}
	}
	if (root > max) {
		root = max
	}
	if (max === 0) {
		/* no symbols to code at all */
		//table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
		//table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
		//table.val[opts.table_index++] = 0;   //here.val = (var short)0;
		table[table_index++] = (1 << 24) | (64 << 16) | 0

		//table.op[opts.table_index] = 64;
		//table.bits[opts.table_index] = 1;
		//table.val[opts.table_index++] = 0;
		table[table_index++] = (1 << 24) | (64 << 16) | 0
		opts.bits = 1
		return 0 /* no symbols, but wait for decoding to report error */
	}
	for (min = 1; min < max; min++) {
		if (count[min] !== 0) {
			break
		}
	}
	if (root < min) {
		root = min
	}

	/* check for an over-subscribed or incomplete set of lengths */
	left = 1
	for (len = 1; len <= MAXBITS; len++) {
		left <<= 1
		left -= count[len]
		if (left < 0) {
			return -1
		} /* over-subscribed */
	}
	if (left > 0 && (type === CODES$1 || max !== 1)) {
		return -1 /* incomplete set */
	}

	/* generate offsets into symbol table for each length for sorting */
	offs[1] = 0
	for (len = 1; len < MAXBITS; len++) {
		offs[len + 1] = offs[len] + count[len]
	}

	/* sort symbols by length, by symbol order within each length */
	for (sym = 0; sym < codes; sym++) {
		if (lens[lens_index + sym] !== 0) {
			work[offs[lens[lens_index + sym]]++] = sym
		}
	}

	/*
   Create and fill in decoding tables.  In this loop, the table being
   filled is at next and has curr index bits.  The code being used is huff
   with length len.  That code is converted to an index by dropping drop
   bits off of the bottom.  For codes where len is less than drop + curr,
   those top drop + curr - len bits are incremented through all values to
   fill the table with replicated entries.
    root is the number of index bits for the root table.  When len exceeds
   root, sub-tables are created pointed to by the root entry with an index
   of the low root bits of huff.  This is saved in low to check for when a
   new sub-table should be started.  drop is zero when the root table is
   being filled, and drop is root when sub-tables are being filled.
    When a new sub-table is needed, it is necessary to look ahead in the
   code lengths to determine what size sub-table is needed.  The length
   counts are used for this, and so count[] is decremented as codes are
   entered in the tables.
    used keeps track of how many table entries have been allocated from the
   provided *table space.  It is checked for LENS and DIST tables against
   the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
   the initial root table size constants.  See the comments in inftrees.h
   for more information.
    sym increments through all symbols, and the loop terminates when
   all codes of length max, i.e. all codes, have been processed.  This
   routine permits incomplete codes, so another loop after this one fills
   in the rest of the decoding tables with invalid code markers.
   */

	/* set up for code type */
	// poor man optimization - use if-else instead of switch,
	// to avoid deopts in old v8
	if (type === CODES$1) {
		base = extra = work /* dummy value--not used */
		match = 20
	} else if (type === LENS$1) {
		base = lbase
		extra = lext
		match = 257
	} else {
		/* DISTS */
		base = dbase
		extra = dext
		match = 0
	}

	/* initialize opts for loop */
	huff = 0 /* starting code */
	sym = 0 /* starting code symbol */
	len = min /* starting code length */
	next = table_index /* current table to fill in */
	curr = root /* current table index bits */
	drop = 0 /* current bits to drop from code for index */
	low = -1 /* trigger new sub-table when len > root */
	used = 1 << root /* use root table entries */
	mask = used - 1 /* mask for comparing low */

	/* check available table space */
	if ((type === LENS$1 && used > ENOUGH_LENS$1) || (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
		return 1
	}

	/* process all codes and make table entries */
	for (;;) {
		/* create table entry */
		here_bits = len - drop
		if (work[sym] + 1 < match) {
			here_op = 0
			here_val = work[sym]
		} else if (work[sym] >= match) {
			here_op = extra[work[sym] - match]
			here_val = base[work[sym] - match]
		} else {
			here_op = 32 + 64 /* end of block */
			here_val = 0
		}

		/* replicate for those indices with low len bits equal to huff */
		incr = 1 << (len - drop)
		fill = 1 << curr
		min = fill /* save offset to next table */
		do {
			fill -= incr
			table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val | 0
		} while (fill !== 0)

		/* backwards increment the len-bit code huff */
		incr = 1 << (len - 1)
		while (huff & incr) {
			incr >>= 1
		}
		if (incr !== 0) {
			huff &= incr - 1
			huff += incr
		} else {
			huff = 0
		}

		/* go to next symbol, update count, len */
		sym++
		if (--count[len] === 0) {
			if (len === max) {
				break
			}
			len = lens[lens_index + work[sym]]
		}

		/* create new sub-table if needed */
		if (len > root && (huff & mask) !== low) {
			/* if first time, transition to sub-tables */
			if (drop === 0) {
				drop = root
			}

			/* increment past last table */
			next += min /* here min is 1 << curr */

			/* determine length of next table */
			curr = len - drop
			left = 1 << curr
			while (curr + drop < max) {
				left -= count[curr + drop]
				if (left <= 0) {
					break
				}
				curr++
				left <<= 1
			}

			/* check for enough space */
			used += 1 << curr
			if ((type === LENS$1 && used > ENOUGH_LENS$1) || (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
				return 1
			}

			/* point entry in root table to sub-table */
			low = huff & mask
			/*table.op[low] = curr;
      table.bits[low] = root;
      table.val[low] = next - opts.table_index;*/
			table[low] = (root << 24) | (curr << 16) | (next - table_index) | 0
		}
	}

	/* fill in remaining table entry if code is incomplete (guaranteed to have
   at most one remaining entry, since if the code is incomplete, the
   maximum code length that was allowed to get this far is one bit) */
	if (huff !== 0) {
		//table.op[next + huff] = 64;            /* invalid code marker */
		//table.bits[next + huff] = len - drop;
		//table.val[next + huff] = 0;
		table[next + huff] = ((len - drop) << 24) | (64 << 16) | 0
	}

	/* set return parameters */
	//opts.table_index += used;
	opts.bits = root
	return 0
}
var inftrees = inflate_table$1

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var constants = {
	/* Allowed flush values; see deflate() and inflate() below for details */
	Z_NO_FLUSH: 0,
	Z_PARTIAL_FLUSH: 1,
	Z_SYNC_FLUSH: 2,
	Z_FULL_FLUSH: 3,
	Z_FINISH: 4,
	Z_BLOCK: 5,
	Z_TREES: 6,
	/* Return codes for the compression/decompression functions. Negative values
	 * are errors, positive values are used for special but normal events.
	 */
	Z_OK: 0,
	Z_STREAM_END: 1,
	Z_NEED_DICT: 2,
	Z_ERRNO: -1,
	Z_STREAM_ERROR: -2,
	Z_DATA_ERROR: -3,
	Z_MEM_ERROR: -4,
	Z_BUF_ERROR: -5,
	//Z_VERSION_ERROR: -6,

	/* compression levels */
	Z_NO_COMPRESSION: 0,
	Z_BEST_SPEED: 1,
	Z_BEST_COMPRESSION: 9,
	Z_DEFAULT_COMPRESSION: -1,
	Z_FILTERED: 1,
	Z_HUFFMAN_ONLY: 2,
	Z_RLE: 3,
	Z_FIXED: 4,
	Z_DEFAULT_STRATEGY: 0,
	/* Possible values of the data_type field (though see inflate()) */
	Z_BINARY: 0,
	Z_TEXT: 1,
	//Z_ASCII:                1, // = Z_TEXT (deprecated)
	Z_UNKNOWN: 2,
	/* The deflate compression method */
	Z_DEFLATED: 8,
	//Z_NULL:                 null // Use -1 or null inline, depending on var type
}

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const adler32 = adler32_1
const crc32 = crc32_1
const inflate_fast = inffast
const inflate_table = inftrees
const CODES = 0
const LENS = 1
const DISTS = 2

/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
	Z_FINISH: Z_FINISH$1,
	Z_BLOCK,
	Z_TREES,
	Z_OK: Z_OK$1,
	Z_STREAM_END: Z_STREAM_END$1,
	Z_NEED_DICT: Z_NEED_DICT$1,
	Z_STREAM_ERROR: Z_STREAM_ERROR$1,
	Z_DATA_ERROR: Z_DATA_ERROR$1,
	Z_MEM_ERROR: Z_MEM_ERROR$1,
	Z_BUF_ERROR,
	Z_DEFLATED,
} = constants

/* STATES ====================================================================*/
/* ===========================================================================*/

const HEAD = 16180 /* i: waiting for magic header */
const FLAGS = 16181 /* i: waiting for method and flags (gzip) */
const TIME = 16182 /* i: waiting for modification time (gzip) */
const OS = 16183 /* i: waiting for extra flags and operating system (gzip) */
const EXLEN = 16184 /* i: waiting for extra length (gzip) */
const EXTRA = 16185 /* i: waiting for extra bytes (gzip) */
const NAME = 16186 /* i: waiting for end of file name (gzip) */
const COMMENT = 16187 /* i: waiting for end of comment (gzip) */
const HCRC = 16188 /* i: waiting for header crc (gzip) */
const DICTID = 16189 /* i: waiting for dictionary check value */
const DICT = 16190 /* waiting for inflateSetDictionary() call */
const TYPE = 16191 /* i: waiting for type bits, including last-flag bit */
const TYPEDO = 16192 /* i: same, but skip check to exit inflate on new block */
const STORED = 16193 /* i: waiting for stored size (length and complement) */
const COPY_ = 16194 /* i/o: same as COPY below, but only first time in */
const COPY = 16195 /* i/o: waiting for input or output to copy stored block */
const TABLE = 16196 /* i: waiting for dynamic block table lengths */
const LENLENS = 16197 /* i: waiting for code length code lengths */
const CODELENS = 16198 /* i: waiting for length/lit and distance code lengths */
const LEN_ = 16199 /* i: same as LEN below, but only first time in */
const LEN = 16200 /* i: waiting for length/lit/eob code */
const LENEXT = 16201 /* i: waiting for length extra bits */
const DIST = 16202 /* i: waiting for distance code */
const DISTEXT = 16203 /* i: waiting for distance extra bits */
const MATCH = 16204 /* o: waiting for output space to copy string */
const LIT = 16205 /* o: waiting for output space to write literal */
const CHECK = 16206 /* i: waiting for 32-bit check value */
const LENGTH = 16207 /* i: waiting for 32-bit length (gzip) */
const DONE = 16208 /* finished check, done -- remain here until reset */
const BAD = 16209 /* got a data error -- remain here until reset */
const MEM = 16210 /* got an inflate() memory error -- remain here until reset */
const SYNC = 16211 /* looking for synchronization bytes to restart inflate() */

/* ===========================================================================*/

const ENOUGH_LENS = 852
const ENOUGH_DISTS = 592
//const ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

const MAX_WBITS = 15
/* 32K LZ77 window */
const DEF_WBITS = MAX_WBITS
const zswap32 = q => {
	return ((q >>> 24) & 0xff) + ((q >>> 8) & 0xff00) + ((q & 0xff00) << 8) + ((q & 0xff) << 24)
}
function InflateState() {
	this.strm = null /* pointer back to this zlib stream */
	this.mode = 0 /* current inflate mode */
	this.last = false /* true if processing last block */
	this.wrap = 0 /* bit 0 true for zlib, bit 1 true for gzip,
                    bit 2 true to validate check value */
	this.havedict = false /* true if dictionary provided */
	this.flags = 0 /* gzip header method and flags (0 if zlib), or
                     -1 if raw or no header yet */
	this.dmax = 0 /* zlib header max distance (INFLATE_STRICT) */
	this.check = 0 /* protected copy of check value */
	this.total = 0 /* protected copy of output count */
	// TODO: may be {}
	this.head = null /* where to save gzip header information */

	/* sliding window */
	this.wbits = 0 /* log base 2 of requested window size */
	this.wsize = 0 /* window size or zero if not using window */
	this.whave = 0 /* valid bytes in the window */
	this.wnext = 0 /* window write index */
	this.window = null /* allocated sliding window, if needed */

	/* bit accumulator */
	this.hold = 0 /* input bit accumulator */
	this.bits = 0 /* number of bits in "in" */

	/* for string and stored block copying */
	this.length = 0 /* literal or length of data to copy */
	this.offset = 0 /* distance back to copy string from */

	/* for table and code decoding */
	this.extra = 0 /* extra bits needed */

	/* fixed and dynamic code tables */
	this.lencode = null /* starting table for length/literal codes */
	this.distcode = null /* starting table for distance codes */
	this.lenbits = 0 /* index bits for lencode */
	this.distbits = 0 /* index bits for distcode */

	/* dynamic table building */
	this.ncode = 0 /* number of code length code lengths */
	this.nlen = 0 /* number of length code lengths */
	this.ndist = 0 /* number of distance code lengths */
	this.have = 0 /* number of code lengths in lens[] */
	this.next = null /* next available space in codes[] */

	this.lens = new Uint16Array(320) /* temporary storage for code lengths */
	this.work = new Uint16Array(288) /* work area for code table building */

	/*
   because we don't have pointers in js, we use lencode and distcode directly
   as buffers so we don't need codes
  */
	//this.codes = new Int32Array(ENOUGH);       /* space for code tables */
	this.lendyn = null /* dynamic table for length/literal codes (JS specific) */
	this.distdyn = null /* dynamic table for distance codes (JS specific) */
	this.sane = 0 /* if false, allow invalid distance too far */
	this.back = 0 /* bits back of last unprocessed length/lit */
	this.was = 0 /* initial length of match */
}
const inflateStateCheck = strm => {
	if (!strm) {
		return 1
	}
	const state = strm.state
	if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC) {
		return 1
	}
	return 0
}
const inflateResetKeep = strm => {
	if (inflateStateCheck(strm)) {
		return Z_STREAM_ERROR$1
	}
	const state = strm.state
	strm.total_in = strm.total_out = state.total = 0
	strm.msg = '' /*Z_NULL*/
	if (state.wrap) {
		/* to support ill-conceived Java test suite */
		strm.adler = state.wrap & 1
	}
	state.mode = HEAD
	state.last = 0
	state.havedict = 0
	state.flags = -1
	state.dmax = 32768
	state.head = null /*Z_NULL*/
	state.hold = 0
	state.bits = 0
	//state.lencode = state.distcode = state.next = state.codes;
	state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS)
	state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS)
	state.sane = 1
	state.back = -1
	//Tracev((stderr, "inflate: reset\n"));
	return Z_OK$1
}
const inflateReset = strm => {
	if (inflateStateCheck(strm)) {
		return Z_STREAM_ERROR$1
	}
	const state = strm.state
	state.wsize = 0
	state.whave = 0
	state.wnext = 0
	return inflateResetKeep(strm)
}
const inflateReset2 = (strm, windowBits) => {
	let wrap

	/* get the state */
	if (inflateStateCheck(strm)) {
		return Z_STREAM_ERROR$1
	}
	const state = strm.state

	/* extract wrap request from windowBits parameter */
	if (windowBits < 0) {
		wrap = 0
		windowBits = -windowBits
	} else {
		wrap = (windowBits >> 4) + 5
		if (windowBits < 48) {
			windowBits &= 15
		}
	}

	/* set number of window bits, free window if different */
	if (windowBits && (windowBits < 8 || windowBits > 15)) {
		return Z_STREAM_ERROR$1
	}
	if (state.window !== null && state.wbits !== windowBits) {
		state.window = null
	}

	/* update state and reset the rest of it */
	state.wrap = wrap
	state.wbits = windowBits
	return inflateReset(strm)
}
const inflateInit2 = (strm, windowBits) => {
	if (!strm) {
		return Z_STREAM_ERROR$1
	}
	//strm.msg = Z_NULL;                 /* in case we return an error */

	const state = new InflateState()

	//if (state === Z_NULL) return Z_MEM_ERROR;
	//Tracev((stderr, "inflate: allocated\n"));
	strm.state = state
	state.strm = strm
	state.window = null /*Z_NULL*/
	state.mode = HEAD /* to pass state test in inflateReset2() */
	const ret = inflateReset2(strm, windowBits)
	if (ret !== Z_OK$1) {
		strm.state = null /*Z_NULL*/
	}
	return ret
}
const inflateInit = strm => {
	return inflateInit2(strm, DEF_WBITS)
}

/*
 Return state with length and distance decoding tables and index sizes set to
 fixed code decoding.  Normally this returns fixed tables from inffixed.h.
 If BUILDFIXED is defined, then instead this routine builds the tables the
 first time it's called, and returns those tables the first time and
 thereafter.  This reduces the size of the code by about 2K bytes, in
 exchange for a little execution time.  However, BUILDFIXED should not be
 used for threaded applications, since the rewriting of the tables and virgin
 may not be thread-safe.
 */
let virgin = true
let lenfix, distfix // We have no pointers in JS, so keep tables separate

const fixedtables = state => {
	/* build fixed huffman tables if first call (may not be thread safe) */
	if (virgin) {
		lenfix = new Int32Array(512)
		distfix = new Int32Array(32)

		/* literal/length table */
		let sym = 0
		while (sym < 144) {
			state.lens[sym++] = 8
		}
		while (sym < 256) {
			state.lens[sym++] = 9
		}
		while (sym < 280) {
			state.lens[sym++] = 7
		}
		while (sym < 288) {
			state.lens[sym++] = 8
		}
		inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, {
			bits: 9,
		})

		/* distance table */
		sym = 0
		while (sym < 32) {
			state.lens[sym++] = 5
		}
		inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, {
			bits: 5,
		})

		/* do this just once */
		virgin = false
	}
	state.lencode = lenfix
	state.lenbits = 9
	state.distcode = distfix
	state.distbits = 5
}

/*
 Update the window with the last wsize (normally 32K) bytes written before
 returning.  If window does not exist yet, create it.  This is only called
 when a window is already in use, or when output has been written during this
 inflate call, but the end of the deflate stream has not been reached yet.
 It is also called to create a window for dictionary data when a dictionary
 is loaded.

 Providing output buffers larger than 32K to inflate() should provide a speed
 advantage, since only the last 32K of output is copied to the sliding window
 upon return from inflate(), and since all distances after the first 32K of
 output will fall in the output data, making match copies simpler and faster.
 The advantage may be dependent on the size of the processor's data caches.
 */
const updatewindow = (strm, src, end, copy) => {
	let dist
	const state = strm.state

	/* if it hasn't been done already, allocate space for the window */
	if (state.window === null) {
		state.wsize = 1 << state.wbits
		state.wnext = 0
		state.whave = 0
		state.window = new Uint8Array(state.wsize)
	}

	/* copy state->wsize or less output bytes into the circular window */
	if (copy >= state.wsize) {
		state.window.set(src.subarray(end - state.wsize, end), 0)
		state.wnext = 0
		state.whave = state.wsize
	} else {
		dist = state.wsize - state.wnext
		if (dist > copy) {
			dist = copy
		}
		//zmemcpy(state->window + state->wnext, end - copy, dist);
		state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext)
		copy -= dist
		if (copy) {
			//zmemcpy(state->window, end - copy, copy);
			state.window.set(src.subarray(end - copy, end), 0)
			state.wnext = copy
			state.whave = state.wsize
		} else {
			state.wnext += dist
			if (state.wnext === state.wsize) {
				state.wnext = 0
			}
			if (state.whave < state.wsize) {
				state.whave += dist
			}
		}
	}
	return 0
}
const inflate$1 = (strm, flush) => {
	let state
	let input, output // input/output buffers
	let next /* next input INDEX */
	let put /* next output INDEX */
	let have, left /* available input and output */
	let hold /* bit buffer */
	let bits /* bits in bit buffer */
	let _in, _out /* save starting available input and output */
	let copy /* number of stored or match bytes to copy */
	let from /* where to copy match bytes from */
	let from_source
	let here = 0 /* current decoding table entry */
	let here_bits, here_op, here_val // paked "here" denormalized (JS specific)
	//let last;                   /* parent table entry */
	let last_bits, last_op, last_val // paked "last" denormalized (JS specific)
	let len /* length to copy for repeats, bits to drop */
	let ret /* return code */
	const hbuf = new Uint8Array(4) /* buffer for gzip header crc calculation */
	let opts
	let n // temporary variable for NEED_BITS

	const order =
		/* permutation of code lengths */
		new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15])
	if (inflateStateCheck(strm) || !strm.output || (!strm.input && strm.avail_in !== 0)) {
		return Z_STREAM_ERROR$1
	}
	state = strm.state
	if (state.mode === TYPE) {
		state.mode = TYPEDO
	} /* skip check */

	//--- LOAD() ---
	put = strm.next_out
	output = strm.output
	left = strm.avail_out
	next = strm.next_in
	input = strm.input
	have = strm.avail_in
	hold = state.hold
	bits = state.bits
	//---

	_in = have
	_out = left
	ret = Z_OK$1
	// goto emulation
	inf_leave: for (;;) {
		switch (state.mode) {
			case HEAD:
				if (state.wrap === 0) {
					state.mode = TYPEDO
					break
				}
				//=== NEEDBITS(16);
				while (bits < 16) {
					if (have === 0) {
						break inf_leave
					}
					have--
					hold += input[next++] << bits
					bits += 8
				}
				//===//
				if (state.wrap & 2 && hold === 0x8b1f) {
					/* gzip header */
					if (state.wbits === 0) {
						state.wbits = 15
					}
					state.check = 0 /*crc32(0L, Z_NULL, 0)*/
					//=== CRC2(state.check, hold);
					hbuf[0] = hold & 0xff
					hbuf[1] = (hold >>> 8) & 0xff
					state.check = crc32(state.check, hbuf, 2, 0)
					//===//

					//=== INITBITS();
					hold = 0
					bits = 0
					//===//
					state.mode = FLAGS
					break
				}
				if (state.head) {
					state.head.done = false
				}
				if (
					!(state.wrap & 1) /* check if zlib header allowed */ ||
					(((hold & 0xff) /*BITS(8)*/ << 8) + (hold >> 8)) % 31
				) {
					strm.msg = 'incorrect header check'
					state.mode = BAD
					break
				}
				if ((hold & 0x0f) /*BITS(4)*/ !== Z_DEFLATED) {
					strm.msg = 'unknown compression method'
					state.mode = BAD
					break
				}
				//--- DROPBITS(4) ---//
				hold >>>= 4
				bits -= 4
				//---//
				len = (hold & 0x0f) /*BITS(4)*/ + 8
				if (state.wbits === 0) {
					state.wbits = len
				}
				if (len > 15 || len > state.wbits) {
					strm.msg = 'invalid window size'
					state.mode = BAD
					break
				}

				// !!! pako patch. Force use `options.windowBits` if passed.
				// Required to always use max window size by default.
				state.dmax = 1 << state.wbits
				//state.dmax = 1 << len;

				state.flags = 0 /* indicate zlib header */
				//Tracev((stderr, "inflate:   zlib header ok\n"));
				strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/
				state.mode = hold & 0x200 ? DICTID : TYPE
				//=== INITBITS();
				hold = 0
				bits = 0
				//===//
				break
			case FLAGS:
				//=== NEEDBITS(16); */
				while (bits < 16) {
					if (have === 0) {
						break inf_leave
					}
					have--
					hold += input[next++] << bits
					bits += 8
				}
				//===//
				state.flags = hold
				if ((state.flags & 0xff) !== Z_DEFLATED) {
					strm.msg = 'unknown compression method'
					state.mode = BAD
					break
				}
				if (state.flags & 0xe000) {
					strm.msg = 'unknown header flags set'
					state.mode = BAD
					break
				}
				if (state.head) {
					state.head.text = (hold >> 8) & 1
				}
				if (state.flags & 0x0200 && state.wrap & 4) {
					//=== CRC2(state.check, hold);
					hbuf[0] = hold & 0xff
					hbuf[1] = (hold >>> 8) & 0xff
					state.check = crc32(state.check, hbuf, 2, 0)
					//===//
				}
				//=== INITBITS();
				hold = 0
				bits = 0
				//===//
				state.mode = TIME
			/* falls through */
			case TIME:
				//=== NEEDBITS(32); */
				while (bits < 32) {
					if (have === 0) {
						break inf_leave
					}
					have--
					hold += input[next++] << bits
					bits += 8
				}
				//===//
				if (state.head) {
					state.head.time = hold
				}
				if (state.flags & 0x0200 && state.wrap & 4) {
					//=== CRC4(state.check, hold)
					hbuf[0] = hold & 0xff
					hbuf[1] = (hold >>> 8) & 0xff
					hbuf[2] = (hold >>> 16) & 0xff
					hbuf[3] = (hold >>> 24) & 0xff
					state.check = crc32(state.check, hbuf, 4, 0)
					//===
				}
				//=== INITBITS();
				hold = 0
				bits = 0
				//===//
				state.mode = OS
			/* falls through */
			case OS:
				//=== NEEDBITS(16); */
				while (bits < 16) {
					if (have === 0) {
						break inf_leave
					}
					have--
					hold += input[next++] << bits
					bits += 8
				}
				//===//
				if (state.head) {
					state.head.xflags = hold & 0xff
					state.head.os = hold >> 8
				}
				if (state.flags & 0x0200 && state.wrap & 4) {
					//=== CRC2(state.check, hold);
					hbuf[0] = hold & 0xff
					hbuf[1] = (hold >>> 8) & 0xff
					state.check = crc32(state.check, hbuf, 2, 0)
					//===//
				}
				//=== INITBITS();
				hold = 0
				bits = 0
				//===//
				state.mode = EXLEN
			/* falls through */
			case EXLEN:
				if (state.flags & 0x0400) {
					//=== NEEDBITS(16); */
					while (bits < 16) {
						if (have === 0) {
							break inf_leave
						}
						have--
						hold += input[next++] << bits
						bits += 8
					}
					//===//
					state.length = hold
					if (state.head) {
						state.head.extra_len = hold
					}
					if (state.flags & 0x0200 && state.wrap & 4) {
						//=== CRC2(state.check, hold);
						hbuf[0] = hold & 0xff
						hbuf[1] = (hold >>> 8) & 0xff
						state.check = crc32(state.check, hbuf, 2, 0)
						//===//
					}
					//=== INITBITS();
					hold = 0
					bits = 0
					//===//
				} else if (state.head) {
					state.head.extra = null /*Z_NULL*/
				}
				state.mode = EXTRA
			/* falls through */
			case EXTRA:
				if (state.flags & 0x0400) {
					copy = state.length
					if (copy > have) {
						copy = have
					}
					if (copy) {
						if (state.head) {
							len = state.head.extra_len - state.length
							if (!state.head.extra) {
								// Use untyped array for more convenient processing later
								state.head.extra = new Uint8Array(state.head.extra_len)
							}
							state.head.extra.set(
								input.subarray(
									next,
									// extra field is limited to 65536 bytes
									// - no need for additional size check
									next + copy,
								) /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/,
								len,
							)
							//zmemcpy(state.head.extra + len, next,
							//        len + copy > state.head.extra_max ?
							//        state.head.extra_max - len : copy);
						}
						if (state.flags & 0x0200 && state.wrap & 4) {
							state.check = crc32(state.check, input, copy, next)
						}
						have -= copy
						next += copy
						state.length -= copy
					}
					if (state.length) {
						break inf_leave
					}
				}
				state.length = 0
				state.mode = NAME
			/* falls through */
			case NAME:
				if (state.flags & 0x0800) {
					if (have === 0) {
						break inf_leave
					}
					copy = 0
					do {
						// TODO: 2 or 1 bytes?
						len = input[next + copy++]
						/* use constant limit because in js we should not preallocate memory */
						if (state.head && len && state.length < 65536 /*state.head.name_max*/) {
							state.head.name += String.fromCharCode(len)
						}
					} while (len && copy < have)
					if (state.flags & 0x0200 && state.wrap & 4) {
						state.check = crc32(state.check, input, copy, next)
					}
					have -= copy
					next += copy
					if (len) {
						break inf_leave
					}
				} else if (state.head) {
					state.head.name = null
				}
				state.length = 0
				state.mode = COMMENT
			/* falls through */
			case COMMENT:
				if (state.flags & 0x1000) {
					if (have === 0) {
						break inf_leave
					}
					copy = 0
					do {
						len = input[next + copy++]
						/* use constant limit because in js we should not preallocate memory */
						if (state.head && len && state.length < 65536 /*state.head.comm_max*/) {
							state.head.comment += String.fromCharCode(len)
						}
					} while (len && copy < have)
					if (state.flags & 0x0200 && state.wrap & 4) {
						state.check = crc32(state.check, input, copy, next)
					}
					have -= copy
					next += copy
					if (len) {
						break inf_leave
					}
				} else if (state.head) {
					state.head.comment = null
				}
				state.mode = HCRC
			/* falls through */
			case HCRC:
				if (state.flags & 0x0200) {
					//=== NEEDBITS(16); */
					while (bits < 16) {
						if (have === 0) {
							break inf_leave
						}
						have--
						hold += input[next++] << bits
						bits += 8
					}
					//===//
					if (state.wrap & 4 && hold !== (state.check & 0xffff)) {
						strm.msg = 'header crc mismatch'
						state.mode = BAD
						break
					}
					//=== INITBITS();
					hold = 0
					bits = 0
					//===//
				}
				if (state.head) {
					state.head.hcrc = (state.flags >> 9) & 1
					state.head.done = true
				}
				strm.adler = state.check = 0
				state.mode = TYPE
				break
			case DICTID:
				//=== NEEDBITS(32); */
				while (bits < 32) {
					if (have === 0) {
						break inf_leave
					}
					have--
					hold += input[next++] << bits
					bits += 8
				}
				//===//
				strm.adler = state.check = zswap32(hold)
				//=== INITBITS();
				hold = 0
				bits = 0
				//===//
				state.mode = DICT
			/* falls through */
			case DICT:
				if (state.havedict === 0) {
					//--- RESTORE() ---
					strm.next_out = put
					strm.avail_out = left
					strm.next_in = next
					strm.avail_in = have
					state.hold = hold
					state.bits = bits
					//---
					return Z_NEED_DICT$1
				}
				strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/
				state.mode = TYPE
			/* falls through */
			case TYPE:
				if (flush === Z_BLOCK || flush === Z_TREES) {
					break inf_leave
				}
			/* falls through */
			case TYPEDO:
				if (state.last) {
					//--- BYTEBITS() ---//
					hold >>>= bits & 7
					bits -= bits & 7
					//---//
					state.mode = CHECK
					break
				}
				//=== NEEDBITS(3); */
				while (bits < 3) {
					if (have === 0) {
						break inf_leave
					}
					have--
					hold += input[next++] << bits
					bits += 8
				}
				//===//
				state.last = hold & 0x01 /*BITS(1)*/
				//--- DROPBITS(1) ---//
				hold >>>= 1
				bits -= 1
				//---//

				switch (hold & 0x03 /*BITS(2)*/) {
					case 0:
						/* stored block */
						//Tracev((stderr, "inflate:     stored block%s\n",
						//        state.last ? " (last)" : ""));
						state.mode = STORED
						break
					case 1:
						/* fixed block */
						fixedtables(state)
						//Tracev((stderr, "inflate:     fixed codes block%s\n",
						//        state.last ? " (last)" : ""));
						state.mode = LEN_ /* decode codes */
						if (flush === Z_TREES) {
							//--- DROPBITS(2) ---//
							hold >>>= 2
							bits -= 2
							//---//
							break inf_leave
						}
						break
					case 2:
						/* dynamic block */
						//Tracev((stderr, "inflate:     dynamic codes block%s\n",
						//        state.last ? " (last)" : ""));
						state.mode = TABLE
						break
					case 3:
						strm.msg = 'invalid block type'
						state.mode = BAD
				}
				//--- DROPBITS(2) ---//
				hold >>>= 2
				bits -= 2
				//---//
				break
			case STORED:
				//--- BYTEBITS() ---// /* go to byte boundary */
				hold >>>= bits & 7
				bits -= bits & 7
				//---//
				//=== NEEDBITS(32); */
				while (bits < 32) {
					if (have === 0) {
						break inf_leave
					}
					have--
					hold += input[next++] << bits
					bits += 8
				}
				//===//
				if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
					strm.msg = 'invalid stored block lengths'
					state.mode = BAD
					break
				}
				state.length = hold & 0xffff
				//Tracev((stderr, "inflate:       stored length %u\n",
				//        state.length));
				//=== INITBITS();
				hold = 0
				bits = 0
				//===//
				state.mode = COPY_
				if (flush === Z_TREES) {
					break inf_leave
				}
			/* falls through */
			case COPY_:
				state.mode = COPY
			/* falls through */
			case COPY:
				copy = state.length
				if (copy) {
					if (copy > have) {
						copy = have
					}
					if (copy > left) {
						copy = left
					}
					if (copy === 0) {
						break inf_leave
					}
					//--- zmemcpy(put, next, copy); ---
					output.set(input.subarray(next, next + copy), put)
					//---//
					have -= copy
					next += copy
					left -= copy
					put += copy
					state.length -= copy
					break
				}
				//Tracev((stderr, "inflate:       stored end\n"));
				state.mode = TYPE
				break
			case TABLE:
				//=== NEEDBITS(14); */
				while (bits < 14) {
					if (have === 0) {
						break inf_leave
					}
					have--
					hold += input[next++] << bits
					bits += 8
				}
				//===//
				state.nlen = (hold & 0x1f) /*BITS(5)*/ + 257
				//--- DROPBITS(5) ---//
				hold >>>= 5
				bits -= 5
				//---//
				state.ndist = (hold & 0x1f) /*BITS(5)*/ + 1
				//--- DROPBITS(5) ---//
				hold >>>= 5
				bits -= 5
				//---//
				state.ncode = (hold & 0x0f) /*BITS(4)*/ + 4
				//--- DROPBITS(4) ---//
				hold >>>= 4
				bits -= 4
				//---//
				//#ifndef PKZIP_BUG_WORKAROUND
				if (state.nlen > 286 || state.ndist > 30) {
					strm.msg = 'too many length or distance symbols'
					state.mode = BAD
					break
				}
				//#endif
				//Tracev((stderr, "inflate:       table sizes ok\n"));
				state.have = 0
				state.mode = LENLENS
			/* falls through */
			case LENLENS:
				while (state.have < state.ncode) {
					//=== NEEDBITS(3);
					while (bits < 3) {
						if (have === 0) {
							break inf_leave
						}
						have--
						hold += input[next++] << bits
						bits += 8
					}
					//===//
					state.lens[order[state.have++]] = hold & 0x07 //BITS(3);
					//--- DROPBITS(3) ---//
					hold >>>= 3
					bits -= 3
					//---//
				}
				while (state.have < 19) {
					state.lens[order[state.have++]] = 0
				}
				// We have separate tables & no pointers. 2 commented lines below not needed.
				//state.next = state.codes;
				//state.lencode = state.next;
				// Switch to use dynamic table
				state.lencode = state.lendyn
				state.lenbits = 7
				opts = {
					bits: state.lenbits,
				}
				ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts)
				state.lenbits = opts.bits
				if (ret) {
					strm.msg = 'invalid code lengths set'
					state.mode = BAD
					break
				}
				//Tracev((stderr, "inflate:       code lengths ok\n"));
				state.have = 0
				state.mode = CODELENS
			/* falls through */
			case CODELENS:
				while (state.have < state.nlen + state.ndist) {
					for (;;) {
						here = state.lencode[hold & ((1 << state.lenbits) - 1)] /*BITS(state.lenbits)*/
						here_bits = here >>> 24
						here_op = (here >>> 16) & 0xff
						here_val = here & 0xffff
						if (here_bits <= bits) {
							break
						}
						//--- PULLBYTE() ---//
						if (have === 0) {
							break inf_leave
						}
						have--
						hold += input[next++] << bits
						bits += 8
						//---//
					}
					if (here_val < 16) {
						//--- DROPBITS(here.bits) ---//
						hold >>>= here_bits
						bits -= here_bits
						//---//
						state.lens[state.have++] = here_val
					} else {
						if (here_val === 16) {
							//=== NEEDBITS(here.bits + 2);
							n = here_bits + 2
							while (bits < n) {
								if (have === 0) {
									break inf_leave
								}
								have--
								hold += input[next++] << bits
								bits += 8
							}
							//===//
							//--- DROPBITS(here.bits) ---//
							hold >>>= here_bits
							bits -= here_bits
							//---//
							if (state.have === 0) {
								strm.msg = 'invalid bit length repeat'
								state.mode = BAD
								break
							}
							len = state.lens[state.have - 1]
							copy = 3 + (hold & 0x03) //BITS(2);
							//--- DROPBITS(2) ---//
							hold >>>= 2
							bits -= 2
							//---//
						} else if (here_val === 17) {
							//=== NEEDBITS(here.bits + 3);
							n = here_bits + 3
							while (bits < n) {
								if (have === 0) {
									break inf_leave
								}
								have--
								hold += input[next++] << bits
								bits += 8
							}
							//===//
							//--- DROPBITS(here.bits) ---//
							hold >>>= here_bits
							bits -= here_bits
							//---//
							len = 0
							copy = 3 + (hold & 0x07) //BITS(3);
							//--- DROPBITS(3) ---//
							hold >>>= 3
							bits -= 3
							//---//
						} else {
							//=== NEEDBITS(here.bits + 7);
							n = here_bits + 7
							while (bits < n) {
								if (have === 0) {
									break inf_leave
								}
								have--
								hold += input[next++] << bits
								bits += 8
							}
							//===//
							//--- DROPBITS(here.bits) ---//
							hold >>>= here_bits
							bits -= here_bits
							//---//
							len = 0
							copy = 11 + (hold & 0x7f) //BITS(7);
							//--- DROPBITS(7) ---//
							hold >>>= 7
							bits -= 7
							//---//
						}
						if (state.have + copy > state.nlen + state.ndist) {
							strm.msg = 'invalid bit length repeat'
							state.mode = BAD
							break
						}
						while (copy--) {
							state.lens[state.have++] = len
						}
					}
				}

				/* handle error breaks in while */
				if (state.mode === BAD) {
					break
				}

				/* check for end-of-block code (better have one) */
				if (state.lens[256] === 0) {
					strm.msg = 'invalid code -- missing end-of-block'
					state.mode = BAD
					break
				}

				/* build code tables -- note: do not change the lenbits or distbits
           values here (9 and 6) without reading the comments in inftrees.h
           concerning the ENOUGH constants, which depend on those values */
				state.lenbits = 9
				opts = {
					bits: state.lenbits,
				}
				ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts)
				// We have separate tables & no pointers. 2 commented lines below not needed.
				// state.next_index = opts.table_index;
				state.lenbits = opts.bits
				// state.lencode = state.next;

				if (ret) {
					strm.msg = 'invalid literal/lengths set'
					state.mode = BAD
					break
				}
				state.distbits = 6
				//state.distcode.copy(state.codes);
				// Switch to use dynamic table
				state.distcode = state.distdyn
				opts = {
					bits: state.distbits,
				}
				ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts)
				// We have separate tables & no pointers. 2 commented lines below not needed.
				// state.next_index = opts.table_index;
				state.distbits = opts.bits
				// state.distcode = state.next;

				if (ret) {
					strm.msg = 'invalid distances set'
					state.mode = BAD
					break
				}
				//Tracev((stderr, 'inflate:       codes ok\n'));
				state.mode = LEN_
				if (flush === Z_TREES) {
					break inf_leave
				}
			/* falls through */
			case LEN_:
				state.mode = LEN
			/* falls through */
			case LEN:
				if (have >= 6 && left >= 258) {
					//--- RESTORE() ---
					strm.next_out = put
					strm.avail_out = left
					strm.next_in = next
					strm.avail_in = have
					state.hold = hold
					state.bits = bits
					//---
					inflate_fast(strm, _out)
					//--- LOAD() ---
					put = strm.next_out
					output = strm.output
					left = strm.avail_out
					next = strm.next_in
					input = strm.input
					have = strm.avail_in
					hold = state.hold
					bits = state.bits
					//---

					if (state.mode === TYPE) {
						state.back = -1
					}
					break
				}
				state.back = 0
				for (;;) {
					here = state.lencode[hold & ((1 << state.lenbits) - 1)] /*BITS(state.lenbits)*/
					here_bits = here >>> 24
					here_op = (here >>> 16) & 0xff
					here_val = here & 0xffff
					if (here_bits <= bits) {
						break
					}
					//--- PULLBYTE() ---//
					if (have === 0) {
						break inf_leave
					}
					have--
					hold += input[next++] << bits
					bits += 8
					//---//
				}
				if (here_op && (here_op & 0xf0) === 0) {
					last_bits = here_bits
					last_op = here_op
					last_val = here_val
					for (;;) {
						here =
							state.lencode[
								last_val + ((hold & ((1 << (last_bits + last_op)) - 1)) /*BITS(last.bits + last.op)*/ >> last_bits)
							]
						here_bits = here >>> 24
						here_op = (here >>> 16) & 0xff
						here_val = here & 0xffff
						if (last_bits + here_bits <= bits) {
							break
						}
						//--- PULLBYTE() ---//
						if (have === 0) {
							break inf_leave
						}
						have--
						hold += input[next++] << bits
						bits += 8
						//---//
					}
					//--- DROPBITS(last.bits) ---//
					hold >>>= last_bits
					bits -= last_bits
					//---//
					state.back += last_bits
				}
				//--- DROPBITS(here.bits) ---//
				hold >>>= here_bits
				bits -= here_bits
				//---//
				state.back += here_bits
				state.length = here_val
				if (here_op === 0) {
					//Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
					//        "inflate:         literal '%c'\n" :
					//        "inflate:         literal 0x%02x\n", here.val));
					state.mode = LIT
					break
				}
				if (here_op & 32) {
					//Tracevv((stderr, "inflate:         end of block\n"));
					state.back = -1
					state.mode = TYPE
					break
				}
				if (here_op & 64) {
					strm.msg = 'invalid literal/length code'
					state.mode = BAD
					break
				}
				state.extra = here_op & 15
				state.mode = LENEXT
			/* falls through */
			case LENEXT:
				if (state.extra) {
					//=== NEEDBITS(state.extra);
					n = state.extra
					while (bits < n) {
						if (have === 0) {
							break inf_leave
						}
						have--
						hold += input[next++] << bits
						bits += 8
					}
					//===//
					state.length += hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/
					//--- DROPBITS(state.extra) ---//
					hold >>>= state.extra
					bits -= state.extra
					//---//
					state.back += state.extra
				}
				//Tracevv((stderr, "inflate:         length %u\n", state.length));
				state.was = state.length
				state.mode = DIST
			/* falls through */
			case DIST:
				for (;;) {
					here = state.distcode[hold & ((1 << state.distbits) - 1)] /*BITS(state.distbits)*/
					here_bits = here >>> 24
					here_op = (here >>> 16) & 0xff
					here_val = here & 0xffff
					if (here_bits <= bits) {
						break
					}
					//--- PULLBYTE() ---//
					if (have === 0) {
						break inf_leave
					}
					have--
					hold += input[next++] << bits
					bits += 8
					//---//
				}
				if ((here_op & 0xf0) === 0) {
					last_bits = here_bits
					last_op = here_op
					last_val = here_val
					for (;;) {
						here =
							state.distcode[
								last_val + ((hold & ((1 << (last_bits + last_op)) - 1)) /*BITS(last.bits + last.op)*/ >> last_bits)
							]
						here_bits = here >>> 24
						here_op = (here >>> 16) & 0xff
						here_val = here & 0xffff
						if (last_bits + here_bits <= bits) {
							break
						}
						//--- PULLBYTE() ---//
						if (have === 0) {
							break inf_leave
						}
						have--
						hold += input[next++] << bits
						bits += 8
						//---//
					}
					//--- DROPBITS(last.bits) ---//
					hold >>>= last_bits
					bits -= last_bits
					//---//
					state.back += last_bits
				}
				//--- DROPBITS(here.bits) ---//
				hold >>>= here_bits
				bits -= here_bits
				//---//
				state.back += here_bits
				if (here_op & 64) {
					strm.msg = 'invalid distance code'
					state.mode = BAD
					break
				}
				state.offset = here_val
				state.extra = here_op & 15
				state.mode = DISTEXT
			/* falls through */
			case DISTEXT:
				if (state.extra) {
					//=== NEEDBITS(state.extra);
					n = state.extra
					while (bits < n) {
						if (have === 0) {
							break inf_leave
						}
						have--
						hold += input[next++] << bits
						bits += 8
					}
					//===//
					state.offset += hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/
					//--- DROPBITS(state.extra) ---//
					hold >>>= state.extra
					bits -= state.extra
					//---//
					state.back += state.extra
				}
				//#ifdef INFLATE_STRICT
				if (state.offset > state.dmax) {
					strm.msg = 'invalid distance too far back'
					state.mode = BAD
					break
				}
				//#endif
				//Tracevv((stderr, "inflate:         distance %u\n", state.offset));
				state.mode = MATCH
			/* falls through */
			case MATCH:
				if (left === 0) {
					break inf_leave
				}
				copy = _out - left
				if (state.offset > copy) {
					/* copy from window */
					copy = state.offset - copy
					if (copy > state.whave) {
						if (state.sane) {
							strm.msg = 'invalid distance too far back'
							state.mode = BAD
							break
						}
						// (!) This block is disabled in zlib defaults,
						// don't enable it for binary compatibility
						//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
						//          Trace((stderr, "inflate.c too far\n"));
						//          copy -= state.whave;
						//          if (copy > state.length) { copy = state.length; }
						//          if (copy > left) { copy = left; }
						//          left -= copy;
						//          state.length -= copy;
						//          do {
						//            output[put++] = 0;
						//          } while (--copy);
						//          if (state.length === 0) { state.mode = LEN; }
						//          break;
						//#endif
					}
					if (copy > state.wnext) {
						copy -= state.wnext
						from = state.wsize - copy
					} else {
						from = state.wnext - copy
					}
					if (copy > state.length) {
						copy = state.length
					}
					from_source = state.window
				} else {
					/* copy from output */
					from_source = output
					from = put - state.offset
					copy = state.length
				}
				if (copy > left) {
					copy = left
				}
				left -= copy
				state.length -= copy
				do {
					output[put++] = from_source[from++]
				} while (--copy)
				if (state.length === 0) {
					state.mode = LEN
				}
				break
			case LIT:
				if (left === 0) {
					break inf_leave
				}
				output[put++] = state.length
				left--
				state.mode = LEN
				break
			case CHECK:
				if (state.wrap) {
					//=== NEEDBITS(32);
					while (bits < 32) {
						if (have === 0) {
							break inf_leave
						}
						have--
						// Use '|' instead of '+' to make sure that result is signed
						hold |= input[next++] << bits
						bits += 8
					}
					//===//
					_out -= left
					strm.total_out += _out
					state.total += _out
					if (state.wrap & 4 && _out) {
						strm.adler = state.check =
							/*UPDATE_CHECK(state.check, put - _out, _out);*/
							state.flags
								? crc32(state.check, output, _out, put - _out)
								: adler32(state.check, output, _out, put - _out)
					}
					_out = left
					// NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
					if (state.wrap & 4 && (state.flags ? hold : zswap32(hold)) !== state.check) {
						strm.msg = 'incorrect data check'
						state.mode = BAD
						break
					}
					//=== INITBITS();
					hold = 0
					bits = 0
					//===//
					//Tracev((stderr, "inflate:   check matches trailer\n"));
				}
				state.mode = LENGTH
			/* falls through */
			case LENGTH:
				if (state.wrap && state.flags) {
					//=== NEEDBITS(32);
					while (bits < 32) {
						if (have === 0) {
							break inf_leave
						}
						have--
						hold += input[next++] << bits
						bits += 8
					}
					//===//
					if (state.wrap & 4 && hold !== (state.total & 0xffffffff)) {
						strm.msg = 'incorrect length check'
						state.mode = BAD
						break
					}
					//=== INITBITS();
					hold = 0
					bits = 0
					//===//
					//Tracev((stderr, "inflate:   length matches trailer\n"));
				}
				state.mode = DONE
			/* falls through */
			case DONE:
				ret = Z_STREAM_END$1
				break inf_leave
			case BAD:
				ret = Z_DATA_ERROR$1
				break inf_leave
			case MEM:
				return Z_MEM_ERROR$1
			case SYNC:
			/* falls through */
			default:
				return Z_STREAM_ERROR$1
		}
	}

	// inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

	/*
     Return from inflate(), updating the total counts and the check value.
     If there was no progress during the inflate() call, return a buffer
     error.  Call updatewindow() to create and/or update the window state.
     Note: a memory error from inflate() is non-recoverable.
   */

	//--- RESTORE() ---
	strm.next_out = put
	strm.avail_out = left
	strm.next_in = next
	strm.avail_in = have
	state.hold = hold
	state.bits = bits
	//---

	if (state.wsize || (_out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH$1))) {
		if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out));
	}
	_in -= strm.avail_in
	_out -= strm.avail_out
	strm.total_in += _in
	strm.total_out += _out
	state.total += _out
	if (state.wrap & 4 && _out) {
		strm.adler = state.check =
			/*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
			state.flags
				? crc32(state.check, output, _out, strm.next_out - _out)
				: adler32(state.check, output, _out, strm.next_out - _out)
	}
	strm.data_type =
		state.bits +
		(state.last ? 64 : 0) +
		(state.mode === TYPE ? 128 : 0) +
		(state.mode === LEN_ || state.mode === COPY_ ? 256 : 0)
	if (((_in === 0 && _out === 0) || flush === Z_FINISH$1) && ret === Z_OK$1) {
		ret = Z_BUF_ERROR
	}
	return ret
}
const inflateEnd = strm => {
	if (inflateStateCheck(strm)) {
		return Z_STREAM_ERROR$1
	}
	let state = strm.state
	if (state.window) {
		state.window = null
	}
	strm.state = null
	return Z_OK$1
}
const inflateGetHeader = (strm, head) => {
	/* check state */
	if (inflateStateCheck(strm)) {
		return Z_STREAM_ERROR$1
	}
	const state = strm.state
	if ((state.wrap & 2) === 0) {
		return Z_STREAM_ERROR$1
	}

	/* save header structure */
	state.head = head
	head.done = false
	return Z_OK$1
}
const inflateSetDictionary = (strm, dictionary) => {
	const dictLength = dictionary.length
	let state
	let dictid
	let ret

	/* check state */
	if (inflateStateCheck(strm)) {
		return Z_STREAM_ERROR$1
	}
	state = strm.state
	if (state.wrap !== 0 && state.mode !== DICT) {
		return Z_STREAM_ERROR$1
	}

	/* check for correct dictionary identifier */
	if (state.mode === DICT) {
		dictid = 1 /* adler32(0, null, 0)*/
		/* dictid = adler32(dictid, dictionary, dictLength); */
		dictid = adler32(dictid, dictionary, dictLength, 0)
		if (dictid !== state.check) {
			return Z_DATA_ERROR$1
		}
	}
	/* copy dictionary to window using updatewindow(), which will amend the
   existing dictionary if appropriate */
	ret = updatewindow(strm, dictionary, dictLength, dictLength)
	if (ret) {
		state.mode = MEM
		return Z_MEM_ERROR$1
	}
	state.havedict = 1
	// Tracev((stderr, "inflate:   dictionary set\n"));
	return Z_OK$1
}
inflate$2.inflateReset = inflateReset
inflate$2.inflateReset2 = inflateReset2
inflate$2.inflateResetKeep = inflateResetKeep
inflate$2.inflateInit = inflateInit
inflate$2.inflateInit2 = inflateInit2
inflate$2.inflate = inflate$1
inflate$2.inflateEnd = inflateEnd
inflate$2.inflateGetHeader = inflateGetHeader
inflate$2.inflateSetDictionary = inflateSetDictionary
inflate$2.inflateInfo = 'pako inflate (from Nodeca project)'

var common$1 = {}

const _has = (obj, key) => {
	return Object.prototype.hasOwnProperty.call(obj, key)
}
common$1.assign = function (obj /*from1, from2, from3, ...*/) {
	const sources = Array.prototype.slice.call(arguments, 1)
	while (sources.length) {
		const source = sources.shift()
		if (!source) {
			continue
		}
		if (typeof source !== 'object') {
			throw new TypeError(source + 'must be non-object')
		}
		for (const p in source) {
			if (_has(source, p)) {
				obj[p] = source[p]
			}
		}
	}
	return obj
}

// Join array of chunks to single array.
common$1.flattenChunks = chunks => {
	// calculate data length
	let len = 0
	for (let i = 0, l = chunks.length; i < l; i++) {
		len += chunks[i].length
	}

	// join chunks
	const result = new Uint8Array(len)
	for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
		let chunk = chunks[i]
		result.set(chunk, pos)
		pos += chunk.length
	}
	return result
}

var strings$1 = {}

// Quick check if we can use fast array to bin string conversion
//
// - apply(Array) can fail on Android 2.2
// - apply(Uint8Array) can fail on iOS 5.1 Safari
//
let STR_APPLY_UIA_OK = true
try {
	String.fromCharCode.apply(null, new Uint8Array(1))
} catch (__) {
	STR_APPLY_UIA_OK = false
}

// Table with utf8 lengths (calculated by first byte of sequence)
// Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
// because max possible codepoint is 0x10ffff
const _utf8len = new Uint8Array(256)
for (let q = 0; q < 256; q++) {
	_utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1
}
_utf8len[254] = _utf8len[254] = 1 // Invalid sequence start

// convert string to array (typed, when possible)
strings$1.string2buf = str => {
	if (typeof TextEncoder === 'function' && TextEncoder.prototype.encode) {
		return new TextEncoder().encode(str)
	}
	let buf,
		c,
		c2,
		m_pos,
		i,
		str_len = str.length,
		buf_len = 0

	// count binary size
	for (m_pos = 0; m_pos < str_len; m_pos++) {
		c = str.charCodeAt(m_pos)
		if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
			c2 = str.charCodeAt(m_pos + 1)
			if ((c2 & 0xfc00) === 0xdc00) {
				c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00)
				m_pos++
			}
		}
		buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4
	}

	// allocate buffer
	buf = new Uint8Array(buf_len)

	// convert
	for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
		c = str.charCodeAt(m_pos)
		if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
			c2 = str.charCodeAt(m_pos + 1)
			if ((c2 & 0xfc00) === 0xdc00) {
				c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00)
				m_pos++
			}
		}
		if (c < 0x80) {
			/* one byte */
			buf[i++] = c
		} else if (c < 0x800) {
			/* two bytes */
			buf[i++] = 0xc0 | (c >>> 6)
			buf[i++] = 0x80 | (c & 0x3f)
		} else if (c < 0x10000) {
			/* three bytes */
			buf[i++] = 0xe0 | (c >>> 12)
			buf[i++] = 0x80 | ((c >>> 6) & 0x3f)
			buf[i++] = 0x80 | (c & 0x3f)
		} else {
			/* four bytes */
			buf[i++] = 0xf0 | (c >>> 18)
			buf[i++] = 0x80 | ((c >>> 12) & 0x3f)
			buf[i++] = 0x80 | ((c >>> 6) & 0x3f)
			buf[i++] = 0x80 | (c & 0x3f)
		}
	}
	return buf
}

// Helper
const buf2binstring = (buf, len) => {
	// On Chrome, the arguments in a function call that are allowed is `65534`.
	// If the length of the buffer is smaller than that, we can use this optimization,
	// otherwise we will take a slower path.
	if (len < 65534) {
		if (buf.subarray && STR_APPLY_UIA_OK) {
			return String.fromCharCode.apply(null, buf.length === len ? buf : buf.subarray(0, len))
		}
	}
	let result = ''
	for (let i = 0; i < len; i++) {
		result += String.fromCharCode(buf[i])
	}
	return result
}

// convert array to string
strings$1.buf2string = (buf, max) => {
	const len = max || buf.length
	if (typeof TextDecoder === 'function' && TextDecoder.prototype.decode) {
		return new TextDecoder().decode(buf.subarray(0, max))
	}
	let i, out

	// Reserve max possible length (2 words per char)
	// NB: by unknown reasons, Array is significantly faster for
	//     String.fromCharCode.apply than Uint16Array.
	const utf16buf = new Array(len * 2)
	for (out = 0, i = 0; i < len; ) {
		let c = buf[i++]
		// quick process ascii
		if (c < 0x80) {
			utf16buf[out++] = c
			continue
		}
		let c_len = _utf8len[c]
		// skip 5 & 6 byte codes
		if (c_len > 4) {
			utf16buf[out++] = 0xfffd
			i += c_len - 1
			continue
		}

		// apply mask on first byte
		c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07
		// join the rest
		while (c_len > 1 && i < len) {
			c = (c << 6) | (buf[i++] & 0x3f)
			c_len--
		}

		// terminated by end of string?
		if (c_len > 1) {
			utf16buf[out++] = 0xfffd
			continue
		}
		if (c < 0x10000) {
			utf16buf[out++] = c
		} else {
			c -= 0x10000
			utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff)
			utf16buf[out++] = 0xdc00 | (c & 0x3ff)
		}
	}
	return buf2binstring(utf16buf, out)
}

// Calculate max possible position in utf8 buffer,
// that will not break sequence. If that's not possible
// - (very small limits) return max size as is.
//
// buf[] - utf8 bytes array
// max   - length limit (mandatory);
strings$1.utf8border = (buf, max) => {
	max = max || buf.length
	if (max > buf.length) {
		max = buf.length
	}

	// go back from last position, until start of sequence found
	let pos = max - 1
	while (pos >= 0 && (buf[pos] & 0xc0) === 0x80) {
		pos--
	}

	// Very small and broken sequence,
	// return max, because we should return something anyway.
	if (pos < 0) {
		return max
	}

	// If we came to start of buffer - that means buffer is too small,
	// return max too.
	if (pos === 0) {
		return max
	}
	return pos + _utf8len[buf[pos]] > max ? pos : max
}

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var messages = {
	2: 'need dictionary',
	/* Z_NEED_DICT       2  */
	1: 'stream end',
	/* Z_STREAM_END      1  */
	0: '',
	/* Z_OK              0  */
	'-1': 'file error',
	/* Z_ERRNO         (-1) */
	'-2': 'stream error',
	/* Z_STREAM_ERROR  (-2) */
	'-3': 'data error',
	/* Z_DATA_ERROR    (-3) */
	'-4': 'insufficient memory',
	/* Z_MEM_ERROR     (-4) */
	'-5': 'buffer error',
	/* Z_BUF_ERROR     (-5) */
	'-6': 'incompatible version' /* Z_VERSION_ERROR (-6) */,
}

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function ZStream$1() {
	/* next input byte */
	this.input = null // JS specific, because we have no pointers
	this.next_in = 0
	/* number of bytes available at input */
	this.avail_in = 0
	/* total number of input bytes read so far */
	this.total_in = 0
	/* next output byte should be put there */
	this.output = null // JS specific, because we have no pointers
	this.next_out = 0
	/* remaining free space at output */
	this.avail_out = 0
	/* total number of bytes output so far */
	this.total_out = 0
	/* last error message, NULL if no error */
	this.msg = '' /*Z_NULL*/
	/* not visible by applications */
	this.state = null
	/* best guess about the data type: binary or text */
	this.data_type = 2 /*Z_UNKNOWN*/
	/* adler32 value of the uncompressed data */
	this.adler = 0
}
var zstream = ZStream$1

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function GZheader$1() {
	/* true if compressed data believed to be text */
	this.text = 0
	/* modification time */
	this.time = 0
	/* extra flags (not used when writing a gzip file) */
	this.xflags = 0
	/* operating system */
	this.os = 0
	/* pointer to extra field or Z_NULL if none */
	this.extra = null
	/* extra field length (valid if extra != Z_NULL) */
	this.extra_len = 0 // Actually, we don't need it in JS,
	// but leave for few code modifications

	//
	// Setup limits is not necessary because in js we should not preallocate memory
	// for inflate use constant limit in 65536 bytes
	//

	/* space at extra (only when reading header) */
	// this.extra_max  = 0;
	/* pointer to zero-terminated file name or Z_NULL */
	this.name = ''
	/* space at name (only when reading header) */
	// this.name_max   = 0;
	/* pointer to zero-terminated comment or Z_NULL */
	this.comment = ''
	/* space at comment (only when reading header) */
	// this.comm_max   = 0;
	/* true if there was or will be a header crc */
	this.hcrc = 0
	/* true when done reading gzip header (not used when writing a gzip file) */
	this.done = false
}
var gzheader = GZheader$1

const zlib_inflate = inflate$2
const utils = common$1
const strings = strings$1
const msg = messages
const ZStream = zstream
const GZheader = gzheader
const toString = Object.prototype.toString

/* Public constants ==========================================================*/
/* ===========================================================================*/

const { Z_NO_FLUSH, Z_FINISH, Z_OK, Z_STREAM_END, Z_NEED_DICT, Z_STREAM_ERROR, Z_DATA_ERROR, Z_MEM_ERROR } = constants

/* ===========================================================================*/

/**
 * class Inflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[inflate]]
 * and [[inflateRaw]].
 **/

/* internal
 * inflate.chunks -> Array
 *
 * Chunks of output data, if [[Inflate#onData]] not overridden.
 **/

/**
 * Inflate.result -> Uint8Array|String
 *
 * Uncompressed result, generated by default [[Inflate#onData]]
 * and [[Inflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Inflate#push]] with `Z_FINISH` / `true` param).
 **/

/**
 * Inflate.err -> Number
 *
 * Error code after inflate finished. 0 (Z_OK) on success.
 * Should be checked if broken data possible.
 **/

/**
 * Inflate.msg -> String
 *
 * Error message, if [[Inflate.err]] != 0
 **/

/**
 * new Inflate(options)
 * - options (Object): zlib inflate options.
 *
 * Creates new inflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `windowBits`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw inflate
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 * By default, when no options set, autodetect deflate/gzip data format via
 * wrapper header.
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako')
 * const chunk1 = new Uint8Array([1,2,3,4,5,6,7,8,9])
 * const chunk2 = new Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * const inflate = new pako.Inflate({ level: 3});
 *
 * inflate.push(chunk1, false);
 * inflate.push(chunk2, true);  // true -> last chunk
 *
 * if (inflate.err) { throw new Error(inflate.err); }
 *
 * console.log(inflate.result);
 * ```
 **/
function Inflate(options) {
	this.options = utils.assign(
		{
			chunkSize: 1024 * 64,
			windowBits: 15,
			to: '',
		},
		options || {},
	)
	const opt = this.options

	// Force window size for `raw` data, if not set directly,
	// because we have no header for autodetect.
	if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
		opt.windowBits = -opt.windowBits
		if (opt.windowBits === 0) {
			opt.windowBits = -15
		}
	}

	// If `windowBits` not defined (and mode not raw) - set autodetect flag for gzip/deflate
	if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
		opt.windowBits += 32
	}

	// Gzip header has no info about windows size, we can do autodetect only
	// for deflate. So, if window size not set, force it to max when gzip possible
	if (opt.windowBits > 15 && opt.windowBits < 48) {
		// bit 3 (16) -> gzipped data
		// bit 4 (32) -> autodetect gzip/deflate
		if ((opt.windowBits & 15) === 0) {
			opt.windowBits |= 15
		}
	}
	this.err = 0 // error code, if happens (0 = Z_OK)
	this.msg = '' // error message
	this.ended = false // used to avoid multiple onEnd() calls
	this.chunks = [] // chunks of compressed data

	this.strm = new ZStream()
	this.strm.avail_out = 0
	let status = zlib_inflate.inflateInit2(this.strm, opt.windowBits)
	if (status !== Z_OK) {
		throw new Error(msg[status])
	}
	this.header = new GZheader()
	zlib_inflate.inflateGetHeader(this.strm, this.header)

	// Setup dictionary
	if (opt.dictionary) {
		// Convert data if needed
		if (typeof opt.dictionary === 'string') {
			opt.dictionary = strings.string2buf(opt.dictionary)
		} else if (toString.call(opt.dictionary) === '[object ArrayBuffer]') {
			opt.dictionary = new Uint8Array(opt.dictionary)
		}
		if (opt.raw) {
			//In raw mode we need to set the dictionary early
			status = zlib_inflate.inflateSetDictionary(this.strm, opt.dictionary)
			if (status !== Z_OK) {
				throw new Error(msg[status])
			}
		}
	}
}

/**
 * Inflate#push(data[, flush_mode]) -> Boolean
 * - data (Uint8Array|ArrayBuffer): input data
 * - flush_mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE
 *   flush modes. See constants. Skipped or `false` means Z_NO_FLUSH,
 *   `true` means Z_FINISH.
 *
 * Sends input data to inflate pipe, generating [[Inflate#onData]] calls with
 * new output chunks. Returns `true` on success. If end of stream detected,
 * [[Inflate#onEnd]] will be called.
 *
 * `flush_mode` is not needed for normal operation, because end of stream
 * detected automatically. You may try to use it for advanced things, but
 * this functionality was not tested.
 *
 * On fail call [[Inflate#onEnd]] with error code and return false.
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Inflate.prototype.push = function (data, flush_mode) {
	const strm = this.strm
	const chunkSize = this.options.chunkSize
	const dictionary = this.options.dictionary
	let status, _flush_mode, last_avail_out
	if (this.ended) return false
	if (flush_mode === ~~flush_mode) _flush_mode = flush_mode
	else _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH

	// Convert data if needed
	if (toString.call(data) === '[object ArrayBuffer]') {
		strm.input = new Uint8Array(data)
	} else {
		strm.input = data
	}
	strm.next_in = 0
	strm.avail_in = strm.input.length
	for (;;) {
		if (strm.avail_out === 0) {
			strm.output = new Uint8Array(chunkSize)
			strm.next_out = 0
			strm.avail_out = chunkSize
		}
		status = zlib_inflate.inflate(strm, _flush_mode)
		if (status === Z_NEED_DICT && dictionary) {
			status = zlib_inflate.inflateSetDictionary(strm, dictionary)
			if (status === Z_OK) {
				status = zlib_inflate.inflate(strm, _flush_mode)
			} else if (status === Z_DATA_ERROR) {
				// Replace code with more verbose
				status = Z_NEED_DICT
			}
		}

		// Skip snyc markers if more data follows and not raw mode
		while (strm.avail_in > 0 && status === Z_STREAM_END && strm.state.wrap > 0 && data[strm.next_in] !== 0) {
			zlib_inflate.inflateReset(strm)
			status = zlib_inflate.inflate(strm, _flush_mode)
		}
		switch (status) {
			case Z_STREAM_ERROR:
			case Z_DATA_ERROR:
			case Z_NEED_DICT:
			case Z_MEM_ERROR:
				this.onEnd(status)
				this.ended = true
				return false
		}

		// Remember real `avail_out` value, because we may patch out buffer content
		// to align utf8 strings boundaries.
		last_avail_out = strm.avail_out
		if (strm.next_out) {
			if (strm.avail_out === 0 || status === Z_STREAM_END) {
				if (this.options.to === 'string') {
					let next_out_utf8 = strings.utf8border(strm.output, strm.next_out)
					let tail = strm.next_out - next_out_utf8
					let utf8str = strings.buf2string(strm.output, next_out_utf8)

					// move tail & realign counters
					strm.next_out = tail
					strm.avail_out = chunkSize - tail
					if (tail) strm.output.set(strm.output.subarray(next_out_utf8, next_out_utf8 + tail), 0)
					this.onData(utf8str)
				} else {
					this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out))
				}
			}
		}

		// Must repeat iteration if out buffer is full
		if (status === Z_OK && last_avail_out === 0) continue

		// Finalize if end of stream reached.
		if (status === Z_STREAM_END) {
			status = zlib_inflate.inflateEnd(this.strm)
			this.onEnd(status)
			this.ended = true
			return true
		}
		if (strm.avail_in === 0) break
	}
	return true
}

/**
 * Inflate#onData(chunk) -> Void
 * - chunk (Uint8Array|String): output data. When string output requested,
 *   each chunk will be string.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Inflate.prototype.onData = function (chunk) {
	this.chunks.push(chunk)
}

/**
 * Inflate#onEnd(status) -> Void
 * - status (Number): inflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called either after you tell inflate that the input stream is
 * complete (Z_FINISH). By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Inflate.prototype.onEnd = function (status) {
	// On success - join
	if (status === Z_OK) {
		if (this.options.to === 'string') {
			this.result = this.chunks.join('')
		} else {
			this.result = utils.flattenChunks(this.chunks)
		}
	}
	this.chunks = []
	this.err = status
	this.msg = this.strm.msg
}

/**
 * inflate(data[, options]) -> Uint8Array|String
 * - data (Uint8Array|ArrayBuffer): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Decompress `data` with inflate/ungzip and `options`. Autodetect
 * format via wrapper header by default. That's why we don't provide
 * separate `ungzip` method.
 *
 * Supported options are:
 *
 * - windowBits
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako');
 * const input = pako.deflate(new Uint8Array([1,2,3,4,5,6,7,8,9]));
 * let output;
 *
 * try {
 *   output = pako.inflate(input);
 * } catch (err) {
 *   console.log(err);
 * }
 * ```
 **/
function inflate(input, options) {
	const inflator = new Inflate(options)
	inflator.push(input)

	// That will never happens, if you don't cheat with options :)
	if (inflator.err) throw inflator.msg || msg[inflator.err]
	return inflator.result
}
var inflate_2 = inflate

function f(e, x, d, t, _, h) {
	let i = e.tileXYToRectangle(d, t, _)
	return defined(Rectangle.intersection(i, x, h))
}
function createAvailability(provider) {
	const overallAvailability = [[[0, 0, 1, 0]]]
	const length = overallAvailability.length
	const availability = new TileAvailability(provider.tilingScheme, 19)
	for (let level = 0; level < length; ++level) {
		const levelRanges = overallAvailability[level]
		for (let i = 0; i < levelRanges.length; ++i) {
			const range = levelRanges[i]
			availability.addAvailableTileRange(level, range[0], range[1], range[2], range[3])
		}
	}
	return availability
}
function createHeightmapTerrainData(provider, buffer, level, x, y) {
	const terrainData = new HeightmapTerrainData({
		buffer: provider._transformBuffer(buffer),
		width: provider._width,
		height: provider._height,
		childTileMask: provider._getChildTileMask(x, y, level),
		structure: provider._terrainDataStructure,
	})
	terrainData._skirtHeight = 6000
	provider.availability.addAvailableTileRange(level, x, y, x, y)
	return terrainData
}
class GeoTerrainProvider extends CustomHeightmapTerrainProvider {
	constructor(options) {
		options = defaultValue(options, {})
		super({
			...options,
			ellipsoid: Ellipsoid.WGS84,
			width: 64,
			height: 64,
		})
		if (!defined(options.url)) throw new DeveloperError('options.url is required.')
		this._dataType = defaultValue(options.dataType, 'int16')
		this._url = options.url
		this._subdomains = options.subdomains
		this._token = options.token
		this._rectangles = []
		this._topLevel = 5
		this._bottomLevel = 11
		this._terrainDataStructure = {
			heightScale: 0.001,
			heightOffset: -1e3,
			elementsPerHeight: 3,
			stride: 4,
			elementMultiplier: 256,
			isBigEndian: true,
		}
		this._availability = createAvailability(this)
	}
	get availability() {
		return this._availability
	}
	requestTileGeometry(x, y, level, request) {
		if (level >= this._bottomLevel) return Promise.reject(`${level}该级别不发送请求!`)
		if (level < this._topLevel) {
			return Promise.resolve(
				new HeightmapTerrainData({
					buffer: this._getVHeightBuffer(),
					width: this._width,
					height: this._height,
					childTileMask: this._getChildTileMask(x, y, level),
					structure: this._terrainDataStructure,
				}),
			)
		}
		let s = '',
			url = this._url
		if (Array.isArray(this._subdomains) && this._subdomains.length) {
			s = this._subdomains[(x + y) % this._subdomains.length]
			url = url.replace('{s}', s)
		}
		url = url
			.replace('{token}', this._token)
			.replace('{x}', x)
			.replace('{y}', y)
			.replace('{z}', level + 1)
		const tileResource = Resource.fetchArrayBuffer({
			url,
			request,
		})
		if (!tileResource) return undefined
		return tileResource
			.then(buffer => {
				if (buffer.byteLength < 1000) return Promise.reject('无效数据')
				return inflate_2(buffer)
			})
			.then(uint8Array => {
				return createHeightmapTerrainData(this, uint8Array, level, x, y)
			})
	}
	getTileDataAvailable(e, x, d) {
		if (d < this._bottomLevel) return true
	}
	_transformBuffer(e) {
		let x = 2
		if (this._dataType === 'int16') {
			x = 2
		} else if (this._dataType === 'float') {
			x = 4
		}
		let d = e
		if (d.length !== 22500 * x) return null
		let t,
			_,
			n,
			a,
			r = new ArrayBuffer(x),
			o = new DataView(r),
			s = this._width,
			c = this._height,
			h = new Uint8Array(s * c * 4)
		for (let f = 0; f < c; f++)
			for (let l = 0; l < s; l++) {
				n = parseInt((149 * f) / (c - 1))
				a = parseInt((149 * l) / (s - 1))
				_ = x * (150 * n + a)
				if (4 === x) {
					o.setInt8(0, d[_])
					o.setInt8(1, d[_ + 1])
					o.setInt8(2, d[_ + 2])
					o.setInt8(3, d[_ + 3])
					t = o.getFloat32(0, true)
				} else {
					t = d[_] + 256 * d[_ + 1]
				}
				if (10000 < t || t < -2e3) t = 0
				let u = (t + 1000) / 0.001,
					i = 4 * (f * s + l)
				h[i] = u / 65536
				h[1 + i] = (u - 256 * h[i] * 256) / 256
				h[2 + i] = u - 256 * h[i] * 256 - 256 * h[1 + i]
				h[3 + i] = 255
			}
		return h
	}
	_getVHeightBuffer() {
		let e = this._vHeightBuffer
		if (!defined(e)) {
			e = new Uint8ClampedArray(this._width * this._height * 4)
			for (let x = 0; x < this._width * this._height * 4; ) {
				e[x++] = 15
				e[x++] = 66
				e[x++] = 64
				e[x++] = 255
			}
			this._vHeightBuffer = e
		}
		return e
	}
	_getChildTileMask(x, d, t) {
		let h = new Rectangle()
		let _ = this._tilingScheme,
			i = this._rectangles,
			n = _.tileXYToRectangle(x, d, t),
			a = 0
		for (let r = 0; r < i.length && 15 !== a; ++r) {
			let o = i[r]
			if (!(o.maxLevel <= t)) {
				let s = o.rectangle,
					c = Rectangle.intersection(s, n, h)
				if (defined(c)) {
					if (f(_, s, 2 * x, 2 * d, t + 1, h)) {
						a |= 4
					}
					if (f(_, s, 2 * x + 1, 2 * d, t + 1, h)) {
						a |= 8
					}
					if (f(_, s, 2 * x, 2 * d + 1, t + 1, h)) {
						a |= 1
					}
					if (f(_, s, 2 * x + 1, 2 * d + 1, t + 1, h)) {
						a |= 2
					}
				}
			}
		}
		return a
	}
}

var src = { exports: {} }

var indexLight = { exports: {} }

var indexMinimal = {}

var minimal = {}

var aspromise
var hasRequiredAspromise
function requireAspromise() {
	if (hasRequiredAspromise) return aspromise
	hasRequiredAspromise = 1
	aspromise = asPromise

	/**
	 * Callback as used by {@link util.asPromise}.
	 * @typedef asPromiseCallback
	 * @type {function}
	 * @param {Error|null} error Error, if any
	 * @param {...*} params Additional arguments
	 * @returns {undefined}
	 */

	/**
	 * Returns a promise from a node-style callback function.
	 * @memberof util
	 * @param {asPromiseCallback} fn Function to call
	 * @param {*} ctx Function context
	 * @param {...*} params Function arguments
	 * @returns {Promise<*>} Promisified function
	 */
	function asPromise(fn, ctx /*, varargs */) {
		var params = new Array(arguments.length - 1),
			offset = 0,
			index = 2,
			pending = true
		while (index < arguments.length) params[offset++] = arguments[index++]
		return new Promise(function executor(resolve, reject) {
			params[offset] = function callback(err /*, varargs */) {
				if (pending) {
					pending = false
					if (err) reject(err)
					else {
						var params = new Array(arguments.length - 1),
							offset = 0
						while (offset < params.length) params[offset++] = arguments[offset]
						resolve.apply(null, params)
					}
				}
			}
			try {
				fn.apply(ctx || null, params)
			} catch (err) {
				if (pending) {
					pending = false
					reject(err)
				}
			}
		})
	}
	return aspromise
}

var base64$1 = {}

var hasRequiredBase64
function requireBase64() {
	if (hasRequiredBase64) return base64$1
	hasRequiredBase64 = 1
	;(function (exports) {
		/**
		 * A minimal base64 implementation for number arrays.
		 * @memberof util
		 * @namespace
		 */
		var base64 = exports

		/**
		 * Calculates the byte length of a base64 encoded string.
		 * @param {string} string Base64 encoded string
		 * @returns {number} Byte length
		 */
		base64.length = function length(string) {
			var p = string.length
			if (!p) return 0
			var n = 0
			while (--p % 4 > 1 && string.charAt(p) === '=') ++n
			return Math.ceil(string.length * 3) / 4 - n
		}

		// Base64 encoding table
		var b64 = new Array(64)

		// Base64 decoding table
		var s64 = new Array(123)

		// 65..90, 97..122, 48..57, 43, 47
		for (var i = 0; i < 64; ) s64[(b64[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : (i - 59) | 43)] = i++

		/**
		 * Encodes a buffer to a base64 encoded string.
		 * @param {Uint8Array} buffer Source buffer
		 * @param {number} start Source start
		 * @param {number} end Source end
		 * @returns {string} Base64 encoded string
		 */
		base64.encode = function encode(buffer, start, end) {
			var parts = null,
				chunk = []
			var i = 0,
				// output index
				j = 0,
				// goto index
				t // temporary
			while (start < end) {
				var b = buffer[start++]
				switch (j) {
					case 0:
						chunk[i++] = b64[b >> 2]
						t = (b & 3) << 4
						j = 1
						break
					case 1:
						chunk[i++] = b64[t | (b >> 4)]
						t = (b & 15) << 2
						j = 2
						break
					case 2:
						chunk[i++] = b64[t | (b >> 6)]
						chunk[i++] = b64[b & 63]
						j = 0
						break
				}
				if (i > 8191) {
					;(parts || (parts = [])).push(String.fromCharCode.apply(String, chunk))
					i = 0
				}
			}
			if (j) {
				chunk[i++] = b64[t]
				chunk[i++] = 61
				if (j === 1) chunk[i++] = 61
			}
			if (parts) {
				if (i) parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)))
				return parts.join('')
			}
			return String.fromCharCode.apply(String, chunk.slice(0, i))
		}
		var invalidEncoding = 'invalid encoding'

		/**
		 * Decodes a base64 encoded string to a buffer.
		 * @param {string} string Source string
		 * @param {Uint8Array} buffer Destination buffer
		 * @param {number} offset Destination offset
		 * @returns {number} Number of bytes written
		 * @throws {Error} If encoding is invalid
		 */
		base64.decode = function decode(string, buffer, offset) {
			var start = offset
			var j = 0,
				// goto index
				t // temporary
			for (var i = 0; i < string.length; ) {
				var c = string.charCodeAt(i++)
				if (c === 61 && j > 1) break
				if ((c = s64[c]) === undefined) throw Error(invalidEncoding)
				switch (j) {
					case 0:
						t = c
						j = 1
						break
					case 1:
						buffer[offset++] = (t << 2) | ((c & 48) >> 4)
						t = c
						j = 2
						break
					case 2:
						buffer[offset++] = ((t & 15) << 4) | ((c & 60) >> 2)
						t = c
						j = 3
						break
					case 3:
						buffer[offset++] = ((t & 3) << 6) | c
						j = 0
						break
				}
			}
			if (j === 1) throw Error(invalidEncoding)
			return offset - start
		}

		/**
		 * Tests if the specified string appears to be base64 encoded.
		 * @param {string} string String to test
		 * @returns {boolean} `true` if probably base64 encoded, otherwise false
		 */
		base64.test = function test(string) {
			return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(string)
		}
	})(base64$1)
	return base64$1
}

var eventemitter
var hasRequiredEventemitter
function requireEventemitter() {
	if (hasRequiredEventemitter) return eventemitter
	hasRequiredEventemitter = 1
	eventemitter = EventEmitter

	/**
	 * Constructs a new event emitter instance.
	 * @classdesc A minimal event emitter.
	 * @memberof util
	 * @constructor
	 */
	function EventEmitter() {
		/**
		 * Registered listeners.
		 * @type {Object.<string,*>}
		 * @private
		 */
		this._listeners = {}
	}

	/**
	 * Registers an event listener.
	 * @param {string} evt Event name
	 * @param {function} fn Listener
	 * @param {*} [ctx] Listener context
	 * @returns {util.EventEmitter} `this`
	 */
	EventEmitter.prototype.on = function on(evt, fn, ctx) {
		;(this._listeners[evt] || (this._listeners[evt] = [])).push({
			fn: fn,
			ctx: ctx || this,
		})
		return this
	}

	/**
	 * Removes an event listener or any matching listeners if arguments are omitted.
	 * @param {string} [evt] Event name. Removes all listeners if omitted.
	 * @param {function} [fn] Listener to remove. Removes all listeners of `evt` if omitted.
	 * @returns {util.EventEmitter} `this`
	 */
	EventEmitter.prototype.off = function off(evt, fn) {
		if (evt === undefined) this._listeners = {}
		else {
			if (fn === undefined) this._listeners[evt] = []
			else {
				var listeners = this._listeners[evt]
				for (var i = 0; i < listeners.length; )
					if (listeners[i].fn === fn) listeners.splice(i, 1)
					else ++i
			}
		}
		return this
	}

	/**
	 * Emits an event by calling its listeners with the specified arguments.
	 * @param {string} evt Event name
	 * @param {...*} args Arguments
	 * @returns {util.EventEmitter} `this`
	 */
	EventEmitter.prototype.emit = function emit(evt) {
		var listeners = this._listeners[evt]
		if (listeners) {
			var args = [],
				i = 1
			for (; i < arguments.length; ) args.push(arguments[i++])
			for (i = 0; i < listeners.length; ) listeners[i].fn.apply(listeners[i++].ctx, args)
		}
		return this
	}
	return eventemitter
}

var float
var hasRequiredFloat
function requireFloat() {
	if (hasRequiredFloat) return float
	hasRequiredFloat = 1
	float = factory(factory)

	/**
	 * Reads / writes floats / doubles from / to buffers.
	 * @name util.float
	 * @namespace
	 */

	/**
	 * Writes a 32 bit float to a buffer using little endian byte order.
	 * @name util.float.writeFloatLE
	 * @function
	 * @param {number} val Value to write
	 * @param {Uint8Array} buf Target buffer
	 * @param {number} pos Target buffer offset
	 * @returns {undefined}
	 */

	/**
	 * Writes a 32 bit float to a buffer using big endian byte order.
	 * @name util.float.writeFloatBE
	 * @function
	 * @param {number} val Value to write
	 * @param {Uint8Array} buf Target buffer
	 * @param {number} pos Target buffer offset
	 * @returns {undefined}
	 */

	/**
	 * Reads a 32 bit float from a buffer using little endian byte order.
	 * @name util.float.readFloatLE
	 * @function
	 * @param {Uint8Array} buf Source buffer
	 * @param {number} pos Source buffer offset
	 * @returns {number} Value read
	 */

	/**
	 * Reads a 32 bit float from a buffer using big endian byte order.
	 * @name util.float.readFloatBE
	 * @function
	 * @param {Uint8Array} buf Source buffer
	 * @param {number} pos Source buffer offset
	 * @returns {number} Value read
	 */

	/**
	 * Writes a 64 bit double to a buffer using little endian byte order.
	 * @name util.float.writeDoubleLE
	 * @function
	 * @param {number} val Value to write
	 * @param {Uint8Array} buf Target buffer
	 * @param {number} pos Target buffer offset
	 * @returns {undefined}
	 */

	/**
	 * Writes a 64 bit double to a buffer using big endian byte order.
	 * @name util.float.writeDoubleBE
	 * @function
	 * @param {number} val Value to write
	 * @param {Uint8Array} buf Target buffer
	 * @param {number} pos Target buffer offset
	 * @returns {undefined}
	 */

	/**
	 * Reads a 64 bit double from a buffer using little endian byte order.
	 * @name util.float.readDoubleLE
	 * @function
	 * @param {Uint8Array} buf Source buffer
	 * @param {number} pos Source buffer offset
	 * @returns {number} Value read
	 */

	/**
	 * Reads a 64 bit double from a buffer using big endian byte order.
	 * @name util.float.readDoubleBE
	 * @function
	 * @param {Uint8Array} buf Source buffer
	 * @param {number} pos Source buffer offset
	 * @returns {number} Value read
	 */

	// Factory function for the purpose of node-based testing in modified global environments
	function factory(exports) {
		// float: typed array
		if (typeof Float32Array !== 'undefined')
			(function () {
				var f32 = new Float32Array([-0]),
					f8b = new Uint8Array(f32.buffer),
					le = f8b[3] === 128
				function writeFloat_f32_cpy(val, buf, pos) {
					f32[0] = val
					buf[pos] = f8b[0]
					buf[pos + 1] = f8b[1]
					buf[pos + 2] = f8b[2]
					buf[pos + 3] = f8b[3]
				}
				function writeFloat_f32_rev(val, buf, pos) {
					f32[0] = val
					buf[pos] = f8b[3]
					buf[pos + 1] = f8b[2]
					buf[pos + 2] = f8b[1]
					buf[pos + 3] = f8b[0]
				}

				/* istanbul ignore next */
				exports.writeFloatLE = le ? writeFloat_f32_cpy : writeFloat_f32_rev
				/* istanbul ignore next */
				exports.writeFloatBE = le ? writeFloat_f32_rev : writeFloat_f32_cpy
				function readFloat_f32_cpy(buf, pos) {
					f8b[0] = buf[pos]
					f8b[1] = buf[pos + 1]
					f8b[2] = buf[pos + 2]
					f8b[3] = buf[pos + 3]
					return f32[0]
				}
				function readFloat_f32_rev(buf, pos) {
					f8b[3] = buf[pos]
					f8b[2] = buf[pos + 1]
					f8b[1] = buf[pos + 2]
					f8b[0] = buf[pos + 3]
					return f32[0]
				}

				/* istanbul ignore next */
				exports.readFloatLE = le ? readFloat_f32_cpy : readFloat_f32_rev
				/* istanbul ignore next */
				exports.readFloatBE = le ? readFloat_f32_rev : readFloat_f32_cpy

				// float: ieee754
			})()
		else
			(function () {
				function writeFloat_ieee754(writeUint, val, buf, pos) {
					var sign = val < 0 ? 1 : 0
					if (sign) val = -val
					if (val === 0) writeUint(1 / val > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos)
					else if (isNaN(val)) writeUint(2143289344, buf, pos)
					else if (val > 3.4028234663852886e38)
						// +-Infinity
						writeUint(((sign << 31) | 2139095040) >>> 0, buf, pos)
					else if (val < 1.1754943508222875e-38)
						// denormal
						writeUint(((sign << 31) | Math.round(val / 1.401298464324817e-45)) >>> 0, buf, pos)
					else {
						var exponent = Math.floor(Math.log(val) / Math.LN2),
							mantissa = Math.round(val * Math.pow(2, -exponent) * 8388608) & 8388607
						writeUint(((sign << 31) | ((exponent + 127) << 23) | mantissa) >>> 0, buf, pos)
					}
				}
				exports.writeFloatLE = writeFloat_ieee754.bind(null, writeUintLE)
				exports.writeFloatBE = writeFloat_ieee754.bind(null, writeUintBE)
				function readFloat_ieee754(readUint, buf, pos) {
					var uint = readUint(buf, pos),
						sign = (uint >> 31) * 2 + 1,
						exponent = (uint >>> 23) & 255,
						mantissa = uint & 8388607
					return exponent === 255
						? mantissa
							? NaN
							: sign * Infinity
						: exponent === 0 // denormal
							? sign * 1.401298464324817e-45 * mantissa
							: sign * Math.pow(2, exponent - 150) * (mantissa + 8388608)
				}
				exports.readFloatLE = readFloat_ieee754.bind(null, readUintLE)
				exports.readFloatBE = readFloat_ieee754.bind(null, readUintBE)
			})()

		// double: typed array
		if (typeof Float64Array !== 'undefined')
			(function () {
				var f64 = new Float64Array([-0]),
					f8b = new Uint8Array(f64.buffer),
					le = f8b[7] === 128
				function writeDouble_f64_cpy(val, buf, pos) {
					f64[0] = val
					buf[pos] = f8b[0]
					buf[pos + 1] = f8b[1]
					buf[pos + 2] = f8b[2]
					buf[pos + 3] = f8b[3]
					buf[pos + 4] = f8b[4]
					buf[pos + 5] = f8b[5]
					buf[pos + 6] = f8b[6]
					buf[pos + 7] = f8b[7]
				}
				function writeDouble_f64_rev(val, buf, pos) {
					f64[0] = val
					buf[pos] = f8b[7]
					buf[pos + 1] = f8b[6]
					buf[pos + 2] = f8b[5]
					buf[pos + 3] = f8b[4]
					buf[pos + 4] = f8b[3]
					buf[pos + 5] = f8b[2]
					buf[pos + 6] = f8b[1]
					buf[pos + 7] = f8b[0]
				}

				/* istanbul ignore next */
				exports.writeDoubleLE = le ? writeDouble_f64_cpy : writeDouble_f64_rev
				/* istanbul ignore next */
				exports.writeDoubleBE = le ? writeDouble_f64_rev : writeDouble_f64_cpy
				function readDouble_f64_cpy(buf, pos) {
					f8b[0] = buf[pos]
					f8b[1] = buf[pos + 1]
					f8b[2] = buf[pos + 2]
					f8b[3] = buf[pos + 3]
					f8b[4] = buf[pos + 4]
					f8b[5] = buf[pos + 5]
					f8b[6] = buf[pos + 6]
					f8b[7] = buf[pos + 7]
					return f64[0]
				}
				function readDouble_f64_rev(buf, pos) {
					f8b[7] = buf[pos]
					f8b[6] = buf[pos + 1]
					f8b[5] = buf[pos + 2]
					f8b[4] = buf[pos + 3]
					f8b[3] = buf[pos + 4]
					f8b[2] = buf[pos + 5]
					f8b[1] = buf[pos + 6]
					f8b[0] = buf[pos + 7]
					return f64[0]
				}

				/* istanbul ignore next */
				exports.readDoubleLE = le ? readDouble_f64_cpy : readDouble_f64_rev
				/* istanbul ignore next */
				exports.readDoubleBE = le ? readDouble_f64_rev : readDouble_f64_cpy

				// double: ieee754
			})()
		else
			(function () {
				function writeDouble_ieee754(writeUint, off0, off1, val, buf, pos) {
					var sign = val < 0 ? 1 : 0
					if (sign) val = -val
					if (val === 0) {
						writeUint(0, buf, pos + off0)
						writeUint(1 / val > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos + off1)
					} else if (isNaN(val)) {
						writeUint(0, buf, pos + off0)
						writeUint(2146959360, buf, pos + off1)
					} else if (val > 1.7976931348623157e308) {
						// +-Infinity
						writeUint(0, buf, pos + off0)
						writeUint(((sign << 31) | 2146435072) >>> 0, buf, pos + off1)
					} else {
						var mantissa
						if (val < 2.2250738585072014e-308) {
							// denormal
							mantissa = val / 5e-324
							writeUint(mantissa >>> 0, buf, pos + off0)
							writeUint(((sign << 31) | (mantissa / 4294967296)) >>> 0, buf, pos + off1)
						} else {
							var exponent = Math.floor(Math.log(val) / Math.LN2)
							if (exponent === 1024) exponent = 1023
							mantissa = val * Math.pow(2, -exponent)
							writeUint((mantissa * 4503599627370496) >>> 0, buf, pos + off0)
							writeUint(
								((sign << 31) | ((exponent + 1023) << 20) | ((mantissa * 1048576) & 1048575)) >>> 0,
								buf,
								pos + off1,
							)
						}
					}
				}
				exports.writeDoubleLE = writeDouble_ieee754.bind(null, writeUintLE, 0, 4)
				exports.writeDoubleBE = writeDouble_ieee754.bind(null, writeUintBE, 4, 0)
				function readDouble_ieee754(readUint, off0, off1, buf, pos) {
					var lo = readUint(buf, pos + off0),
						hi = readUint(buf, pos + off1)
					var sign = (hi >> 31) * 2 + 1,
						exponent = (hi >>> 20) & 2047,
						mantissa = 4294967296 * (hi & 1048575) + lo
					return exponent === 2047
						? mantissa
							? NaN
							: sign * Infinity
						: exponent === 0 // denormal
							? sign * 5e-324 * mantissa
							: sign * Math.pow(2, exponent - 1075) * (mantissa + 4503599627370496)
				}
				exports.readDoubleLE = readDouble_ieee754.bind(null, readUintLE, 0, 4)
				exports.readDoubleBE = readDouble_ieee754.bind(null, readUintBE, 4, 0)
			})()
		return exports
	}

	// uint helpers

	function writeUintLE(val, buf, pos) {
		buf[pos] = val & 255
		buf[pos + 1] = (val >>> 8) & 255
		buf[pos + 2] = (val >>> 16) & 255
		buf[pos + 3] = val >>> 24
	}
	function writeUintBE(val, buf, pos) {
		buf[pos] = val >>> 24
		buf[pos + 1] = (val >>> 16) & 255
		buf[pos + 2] = (val >>> 8) & 255
		buf[pos + 3] = val & 255
	}
	function readUintLE(buf, pos) {
		return (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16) | (buf[pos + 3] << 24)) >>> 0
	}
	function readUintBE(buf, pos) {
		return ((buf[pos] << 24) | (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3]) >>> 0
	}
	return float
}

var inquire_1
var hasRequiredInquire
function requireInquire() {
	if (hasRequiredInquire) return inquire_1
	hasRequiredInquire = 1
	inquire_1 = inquire

	/**
	 * Requires a module only if available.
	 * @memberof util
	 * @param {string} moduleName Module to require
	 * @returns {?Object} Required module if available and not empty, otherwise `null`
	 */
	function inquire(moduleName) {
		try {
			var mod = eval('quire'.replace(/^/, 're'))(moduleName) // eslint-disable-line no-eval
			if (mod && (mod.length || Object.keys(mod).length)) return mod
		} catch (e) {} // eslint-disable-line no-empty
		return null
	}
	return inquire_1
}

var utf8$2 = {}

var hasRequiredUtf8
function requireUtf8() {
	if (hasRequiredUtf8) return utf8$2
	hasRequiredUtf8 = 1
	;(function (exports) {
		/**
		 * A minimal UTF8 implementation for number arrays.
		 * @memberof util
		 * @namespace
		 */
		var utf8 = exports

		/**
		 * Calculates the UTF8 byte length of a string.
		 * @param {string} string String
		 * @returns {number} Byte length
		 */
		utf8.length = function utf8_length(string) {
			var len = 0,
				c = 0
			for (var i = 0; i < string.length; ++i) {
				c = string.charCodeAt(i)
				if (c < 128) len += 1
				else if (c < 2048) len += 2
				else if ((c & 0xfc00) === 0xd800 && (string.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
					++i
					len += 4
				} else len += 3
			}
			return len
		}

		/**
		 * Reads UTF8 bytes as a string.
		 * @param {Uint8Array} buffer Source buffer
		 * @param {number} start Source start
		 * @param {number} end Source end
		 * @returns {string} String read
		 */
		utf8.read = function utf8_read(buffer, start, end) {
			var len = end - start
			if (len < 1) return ''
			var parts = null,
				chunk = [],
				i = 0,
				// char offset
				t // temporary
			while (start < end) {
				t = buffer[start++]
				if (t < 128) chunk[i++] = t
				else if (t > 191 && t < 224) chunk[i++] = ((t & 31) << 6) | (buffer[start++] & 63)
				else if (t > 239 && t < 365) {
					t =
						(((t & 7) << 18) |
							((buffer[start++] & 63) << 12) |
							((buffer[start++] & 63) << 6) |
							(buffer[start++] & 63)) -
						0x10000
					chunk[i++] = 0xd800 + (t >> 10)
					chunk[i++] = 0xdc00 + (t & 1023)
				} else chunk[i++] = ((t & 15) << 12) | ((buffer[start++] & 63) << 6) | (buffer[start++] & 63)
				if (i > 8191) {
					;(parts || (parts = [])).push(String.fromCharCode.apply(String, chunk))
					i = 0
				}
			}
			if (parts) {
				if (i) parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)))
				return parts.join('')
			}
			return String.fromCharCode.apply(String, chunk.slice(0, i))
		}

		/**
		 * Writes a string as UTF8 bytes.
		 * @param {string} string Source string
		 * @param {Uint8Array} buffer Destination buffer
		 * @param {number} offset Destination offset
		 * @returns {number} Bytes written
		 */
		utf8.write = function utf8_write(string, buffer, offset) {
			var start = offset,
				c1,
				// character 1
				c2 // character 2
			for (var i = 0; i < string.length; ++i) {
				c1 = string.charCodeAt(i)
				if (c1 < 128) {
					buffer[offset++] = c1
				} else if (c1 < 2048) {
					buffer[offset++] = (c1 >> 6) | 192
					buffer[offset++] = (c1 & 63) | 128
				} else if ((c1 & 0xfc00) === 0xd800 && ((c2 = string.charCodeAt(i + 1)) & 0xfc00) === 0xdc00) {
					c1 = 0x10000 + ((c1 & 0x03ff) << 10) + (c2 & 0x03ff)
					++i
					buffer[offset++] = (c1 >> 18) | 240
					buffer[offset++] = ((c1 >> 12) & 63) | 128
					buffer[offset++] = ((c1 >> 6) & 63) | 128
					buffer[offset++] = (c1 & 63) | 128
				} else {
					buffer[offset++] = (c1 >> 12) | 224
					buffer[offset++] = ((c1 >> 6) & 63) | 128
					buffer[offset++] = (c1 & 63) | 128
				}
			}
			return offset - start
		}
	})(utf8$2)
	return utf8$2
}

var pool_1
var hasRequiredPool
function requirePool() {
	if (hasRequiredPool) return pool_1
	hasRequiredPool = 1
	pool_1 = pool

	/**
	 * An allocator as used by {@link util.pool}.
	 * @typedef PoolAllocator
	 * @type {function}
	 * @param {number} size Buffer size
	 * @returns {Uint8Array} Buffer
	 */

	/**
	 * A slicer as used by {@link util.pool}.
	 * @typedef PoolSlicer
	 * @type {function}
	 * @param {number} start Start offset
	 * @param {number} end End offset
	 * @returns {Uint8Array} Buffer slice
	 * @this {Uint8Array}
	 */

	/**
	 * A general purpose buffer pool.
	 * @memberof util
	 * @function
	 * @param {PoolAllocator} alloc Allocator
	 * @param {PoolSlicer} slice Slicer
	 * @param {number} [size=8192] Slab size
	 * @returns {PoolAllocator} Pooled allocator
	 */
	function pool(alloc, slice, size) {
		var SIZE = size || 8192
		var MAX = SIZE >>> 1
		var slab = null
		var offset = SIZE
		return function pool_alloc(size) {
			if (size < 1 || size > MAX) return alloc(size)
			if (offset + size > SIZE) {
				slab = alloc(SIZE)
				offset = 0
			}
			var buf = slice.call(slab, offset, (offset += size))
			if (offset & 7)
				// align to 32 bit
				offset = (offset | 7) + 1
			return buf
		}
	}
	return pool_1
}

var longbits
var hasRequiredLongbits
function requireLongbits() {
	if (hasRequiredLongbits) return longbits
	hasRequiredLongbits = 1
	longbits = LongBits
	var util = requireMinimal()

	/**
	 * Constructs new long bits.
	 * @classdesc Helper class for working with the low and high bits of a 64 bit value.
	 * @memberof util
	 * @constructor
	 * @param {number} lo Low 32 bits, unsigned
	 * @param {number} hi High 32 bits, unsigned
	 */
	function LongBits(lo, hi) {
		// note that the casts below are theoretically unnecessary as of today, but older statically
		// generated converter code might still call the ctor with signed 32bits. kept for compat.

		/**
		 * Low bits.
		 * @type {number}
		 */
		this.lo = lo >>> 0

		/**
		 * High bits.
		 * @type {number}
		 */
		this.hi = hi >>> 0
	}

	/**
	 * Zero bits.
	 * @memberof util.LongBits
	 * @type {util.LongBits}
	 */
	var zero = (LongBits.zero = new LongBits(0, 0))
	zero.toNumber = function () {
		return 0
	}
	zero.zzEncode = zero.zzDecode = function () {
		return this
	}
	zero.length = function () {
		return 1
	}

	/**
	 * Zero hash.
	 * @memberof util.LongBits
	 * @type {string}
	 */
	var zeroHash = (LongBits.zeroHash = '\0\0\0\0\0\0\0\0')

	/**
	 * Constructs new long bits from the specified number.
	 * @param {number} value Value
	 * @returns {util.LongBits} Instance
	 */
	LongBits.fromNumber = function fromNumber(value) {
		if (value === 0) return zero
		var sign = value < 0
		if (sign) value = -value
		var lo = value >>> 0,
			hi = ((value - lo) / 4294967296) >>> 0
		if (sign) {
			hi = ~hi >>> 0
			lo = ~lo >>> 0
			if (++lo > 4294967295) {
				lo = 0
				if (++hi > 4294967295) hi = 0
			}
		}
		return new LongBits(lo, hi)
	}

	/**
	 * Constructs new long bits from a number, long or string.
	 * @param {Long|number|string} value Value
	 * @returns {util.LongBits} Instance
	 */
	LongBits.from = function from(value) {
		if (typeof value === 'number') return LongBits.fromNumber(value)
		if (util.isString(value)) {
			/* istanbul ignore else */
			if (util.Long) value = util.Long.fromString(value)
			else return LongBits.fromNumber(parseInt(value, 10))
		}
		return value.low || value.high ? new LongBits(value.low >>> 0, value.high >>> 0) : zero
	}

	/**
	 * Converts this long bits to a possibly unsafe JavaScript number.
	 * @param {boolean} [unsigned=false] Whether unsigned or not
	 * @returns {number} Possibly unsafe number
	 */
	LongBits.prototype.toNumber = function toNumber(unsigned) {
		if (!unsigned && this.hi >>> 31) {
			var lo = (~this.lo + 1) >>> 0,
				hi = ~this.hi >>> 0
			if (!lo) hi = (hi + 1) >>> 0
			return -(lo + hi * 4294967296)
		}
		return this.lo + this.hi * 4294967296
	}

	/**
	 * Converts this long bits to a long.
	 * @param {boolean} [unsigned=false] Whether unsigned or not
	 * @returns {Long} Long
	 */
	LongBits.prototype.toLong = function toLong(unsigned) {
		return util.Long
			? new util.Long(this.lo | 0, this.hi | 0, Boolean(unsigned))
			: /* istanbul ignore next */ {
					low: this.lo | 0,
					high: this.hi | 0,
					unsigned: Boolean(unsigned),
				}
	}
	var charCodeAt = String.prototype.charCodeAt

	/**
	 * Constructs new long bits from the specified 8 characters long hash.
	 * @param {string} hash Hash
	 * @returns {util.LongBits} Bits
	 */
	LongBits.fromHash = function fromHash(hash) {
		if (hash === zeroHash) return zero
		return new LongBits(
			(charCodeAt.call(hash, 0) |
				(charCodeAt.call(hash, 1) << 8) |
				(charCodeAt.call(hash, 2) << 16) |
				(charCodeAt.call(hash, 3) << 24)) >>>
				0,
			(charCodeAt.call(hash, 4) |
				(charCodeAt.call(hash, 5) << 8) |
				(charCodeAt.call(hash, 6) << 16) |
				(charCodeAt.call(hash, 7) << 24)) >>>
				0,
		)
	}

	/**
	 * Converts this long bits to a 8 characters long hash.
	 * @returns {string} Hash
	 */
	LongBits.prototype.toHash = function toHash() {
		return String.fromCharCode(
			this.lo & 255,
			(this.lo >>> 8) & 255,
			(this.lo >>> 16) & 255,
			this.lo >>> 24,
			this.hi & 255,
			(this.hi >>> 8) & 255,
			(this.hi >>> 16) & 255,
			this.hi >>> 24,
		)
	}

	/**
	 * Zig-zag encodes this long bits.
	 * @returns {util.LongBits} `this`
	 */
	LongBits.prototype.zzEncode = function zzEncode() {
		var mask = this.hi >> 31
		this.hi = (((this.hi << 1) | (this.lo >>> 31)) ^ mask) >>> 0
		this.lo = ((this.lo << 1) ^ mask) >>> 0
		return this
	}

	/**
	 * Zig-zag decodes this long bits.
	 * @returns {util.LongBits} `this`
	 */
	LongBits.prototype.zzDecode = function zzDecode() {
		var mask = -(this.lo & 1)
		this.lo = (((this.lo >>> 1) | (this.hi << 31)) ^ mask) >>> 0
		this.hi = ((this.hi >>> 1) ^ mask) >>> 0
		return this
	}

	/**
	 * Calculates the length of this longbits when encoded as a varint.
	 * @returns {number} Length
	 */
	LongBits.prototype.length = function length() {
		var part0 = this.lo,
			part1 = ((this.lo >>> 28) | (this.hi << 4)) >>> 0,
			part2 = this.hi >>> 24
		return part2 === 0
			? part1 === 0
				? part0 < 16384
					? part0 < 128
						? 1
						: 2
					: part0 < 2097152
						? 3
						: 4
				: part1 < 16384
					? part1 < 128
						? 5
						: 6
					: part1 < 2097152
						? 7
						: 8
			: part2 < 128
				? 9
				: 10
	}
	return longbits
}

var hasRequiredMinimal
function requireMinimal() {
	if (hasRequiredMinimal) return minimal
	hasRequiredMinimal = 1
	;(function (exports) {
		var util = exports

		// used to return a Promise where callback is omitted
		util.asPromise = requireAspromise()

		// converts to / from base64 encoded strings
		util.base64 = requireBase64()

		// base class of rpc.Service
		util.EventEmitter = requireEventemitter()

		// float handling accross browsers
		util.float = requireFloat()

		// requires modules optionally and hides the call from bundlers
		util.inquire = requireInquire()

		// converts to / from utf8 encoded strings
		util.utf8 = requireUtf8()

		// provides a node-like buffer pool in the browser
		util.pool = requirePool()

		// utility to work with the low and high bits of a 64 bit value
		util.LongBits = requireLongbits()

		/**
		 * Whether running within node or not.
		 * @memberof util
		 * @type {boolean}
		 */
		util.isNode = Boolean(
			typeof commonjsGlobal !== 'undefined' &&
				commonjsGlobal &&
				commonjsGlobal.process &&
				commonjsGlobal.process.versions &&
				commonjsGlobal.process.versions.node,
		)

		/**
		 * Global object reference.
		 * @memberof util
		 * @type {Object}
		 */
		util.global =
			(util.isNode && commonjsGlobal) ||
			(typeof window !== 'undefined' && window) ||
			(typeof self !== 'undefined' && self) ||
			commonjsGlobal // eslint-disable-line no-invalid-this

		/**
		 * An immuable empty array.
		 * @memberof util
		 * @type {Array.<*>}
		 * @const
		 */
		util.emptyArray = Object.freeze ? Object.freeze([]) : /* istanbul ignore next */ [] // used on prototypes

		/**
		 * An immutable empty object.
		 * @type {Object}
		 * @const
		 */
		util.emptyObject = Object.freeze ? Object.freeze({}) : /* istanbul ignore next */ {} // used on prototypes

		/**
		 * Tests if the specified value is an integer.
		 * @function
		 * @param {*} value Value to test
		 * @returns {boolean} `true` if the value is an integer
		 */
		util.isInteger =
			Number.isInteger ||
			/* istanbul ignore next */ function isInteger(value) {
				return typeof value === 'number' && isFinite(value) && Math.floor(value) === value
			}

		/**
		 * Tests if the specified value is a string.
		 * @param {*} value Value to test
		 * @returns {boolean} `true` if the value is a string
		 */
		util.isString = function isString(value) {
			return typeof value === 'string' || value instanceof String
		}

		/**
		 * Tests if the specified value is a non-null object.
		 * @param {*} value Value to test
		 * @returns {boolean} `true` if the value is a non-null object
		 */
		util.isObject = function isObject(value) {
			return value && typeof value === 'object'
		}

		/**
		 * Checks if a property on a message is considered to be present.
		 * This is an alias of {@link util.isSet}.
		 * @function
		 * @param {Object} obj Plain object or message instance
		 * @param {string} prop Property name
		 * @returns {boolean} `true` if considered to be present, otherwise `false`
		 */
		util.isset =
			/**
			 * Checks if a property on a message is considered to be present.
			 * @param {Object} obj Plain object or message instance
			 * @param {string} prop Property name
			 * @returns {boolean} `true` if considered to be present, otherwise `false`
			 */
			util.isSet = function isSet(obj, prop) {
				var value = obj[prop]
				if (value != null && obj.hasOwnProperty(prop))
					// eslint-disable-line eqeqeq, no-prototype-builtins
					return typeof value !== 'object' || (Array.isArray(value) ? value.length : Object.keys(value).length) > 0
				return false
			}

		/**
		 * Any compatible Buffer instance.
		 * This is a minimal stand-alone definition of a Buffer instance. The actual type is that exported by node's typings.
		 * @interface Buffer
		 * @extends Uint8Array
		 */

		/**
		 * Node's Buffer class if available.
		 * @type {Constructor<Buffer>}
		 */
		util.Buffer = (function () {
			try {
				var Buffer = util.inquire('buffer').Buffer
				// refuse to use non-node buffers if not explicitly assigned (perf reasons):
				return Buffer.prototype.utf8Write ? Buffer : /* istanbul ignore next */ null
			} catch (e) {
				/* istanbul ignore next */
				return null
			}
		})()

		// Internal alias of or polyfull for Buffer.from.
		util._Buffer_from = null

		// Internal alias of or polyfill for Buffer.allocUnsafe.
		util._Buffer_allocUnsafe = null

		/**
		 * Creates a new buffer of whatever type supported by the environment.
		 * @param {number|number[]} [sizeOrArray=0] Buffer size or number array
		 * @returns {Uint8Array|Buffer} Buffer
		 */
		util.newBuffer = function newBuffer(sizeOrArray) {
			/* istanbul ignore next */
			return typeof sizeOrArray === 'number'
				? util.Buffer
					? util._Buffer_allocUnsafe(sizeOrArray)
					: new util.Array(sizeOrArray)
				: util.Buffer
					? util._Buffer_from(sizeOrArray)
					: typeof Uint8Array === 'undefined'
						? sizeOrArray
						: new Uint8Array(sizeOrArray)
		}

		/**
		 * Array implementation used in the browser. `Uint8Array` if supported, otherwise `Array`.
		 * @type {Constructor<Uint8Array>}
		 */
		util.Array = typeof Uint8Array !== 'undefined' ? Uint8Array /* istanbul ignore next */ : Array

		/**
		 * Any compatible Long instance.
		 * This is a minimal stand-alone definition of a Long instance. The actual type is that exported by long.js.
		 * @interface Long
		 * @property {number} low Low bits
		 * @property {number} high High bits
		 * @property {boolean} unsigned Whether unsigned or not
		 */

		/**
		 * Long.js's Long class if available.
		 * @type {Constructor<Long>}
		 */
		util.Long =
			/* istanbul ignore next */ (util.global.dcodeIO && /* istanbul ignore next */ util.global.dcodeIO.Long) ||
			/* istanbul ignore next */ util.global.Long ||
			util.inquire('long')

		/**
		 * Regular expression used to verify 2 bit (`bool`) map keys.
		 * @type {RegExp}
		 * @const
		 */
		util.key2Re = /^true|false|0|1$/

		/**
		 * Regular expression used to verify 32 bit (`int32` etc.) map keys.
		 * @type {RegExp}
		 * @const
		 */
		util.key32Re = /^-?(?:0|[1-9][0-9]*)$/

		/**
		 * Regular expression used to verify 64 bit (`int64` etc.) map keys.
		 * @type {RegExp}
		 * @const
		 */
		util.key64Re = /^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/

		/**
		 * Converts a number or long to an 8 characters long hash string.
		 * @param {Long|number} value Value to convert
		 * @returns {string} Hash
		 */
		util.longToHash = function longToHash(value) {
			return value ? util.LongBits.from(value).toHash() : util.LongBits.zeroHash
		}

		/**
		 * Converts an 8 characters long hash string to a long or number.
		 * @param {string} hash Hash
		 * @param {boolean} [unsigned=false] Whether unsigned or not
		 * @returns {Long|number} Original value
		 */
		util.longFromHash = function longFromHash(hash, unsigned) {
			var bits = util.LongBits.fromHash(hash)
			if (util.Long) return util.Long.fromBits(bits.lo, bits.hi, unsigned)
			return bits.toNumber(Boolean(unsigned))
		}

		/**
		 * Merges the properties of the source object into the destination object.
		 * @memberof util
		 * @param {Object.<string,*>} dst Destination object
		 * @param {Object.<string,*>} src Source object
		 * @param {boolean} [ifNotSet=false] Merges only if the key is not already set
		 * @returns {Object.<string,*>} Destination object
		 */
		function merge(dst, src, ifNotSet) {
			// used by converters
			for (var keys = Object.keys(src), i = 0; i < keys.length; ++i)
				if (dst[keys[i]] === undefined || !ifNotSet) dst[keys[i]] = src[keys[i]]
			return dst
		}
		util.merge = merge

		/**
		 * Converts the first character of a string to lower case.
		 * @param {string} str String to convert
		 * @returns {string} Converted string
		 */
		util.lcFirst = function lcFirst(str) {
			return str.charAt(0).toLowerCase() + str.substring(1)
		}

		/**
		 * Creates a custom error constructor.
		 * @memberof util
		 * @param {string} name Error name
		 * @returns {Constructor<Error>} Custom error constructor
		 */
		function newError(name) {
			function CustomError(message, properties) {
				if (!(this instanceof CustomError)) return new CustomError(message, properties)

				// Error.call(this, message);
				// ^ just returns a new error instance because the ctor can be called as a function

				Object.defineProperty(this, 'message', {
					get: function () {
						return message
					},
				})

				/* istanbul ignore next */
				if (Error.captureStackTrace)
					// node
					Error.captureStackTrace(this, CustomError)
				else
					Object.defineProperty(this, 'stack', {
						value: new Error().stack || '',
					})
				if (properties) merge(this, properties)
			}
			CustomError.prototype = Object.create(Error.prototype, {
				constructor: {
					value: CustomError,
					writable: true,
					enumerable: false,
					configurable: true,
				},
				name: {
					get: function get() {
						return name
					},
					set: undefined,
					enumerable: false,
					// configurable: false would accurately preserve the behavior of
					// the original, but I'm guessing that was not intentional.
					// For an actual error subclass, this property would
					// be configurable.
					configurable: true,
				},
				toString: {
					value: function value() {
						return this.name + ': ' + this.message
					},
					writable: true,
					enumerable: false,
					configurable: true,
				},
			})
			return CustomError
		}
		util.newError = newError

		/**
		 * Constructs a new protocol error.
		 * @classdesc Error subclass indicating a protocol specifc error.
		 * @memberof util
		 * @extends Error
		 * @template T extends Message<T>
		 * @constructor
		 * @param {string} message Error message
		 * @param {Object.<string,*>} [properties] Additional properties
		 * @example
		 * try {
		 *     MyMessage.decode(someBuffer); // throws if required fields are missing
		 * } catch (e) {
		 *     if (e instanceof ProtocolError && e.instance)
		 *         console.log("decoded so far: " + JSON.stringify(e.instance));
		 * }
		 */
		util.ProtocolError = newError('ProtocolError')

		/**
		 * So far decoded message instance.
		 * @name util.ProtocolError#instance
		 * @type {Message<T>}
		 */

		/**
		 * A OneOf getter as returned by {@link util.oneOfGetter}.
		 * @typedef OneOfGetter
		 * @type {function}
		 * @returns {string|undefined} Set field name, if any
		 */

		/**
		 * Builds a getter for a oneof's present field name.
		 * @param {string[]} fieldNames Field names
		 * @returns {OneOfGetter} Unbound getter
		 */
		util.oneOfGetter = function getOneOf(fieldNames) {
			var fieldMap = {}
			for (var i = 0; i < fieldNames.length; ++i) fieldMap[fieldNames[i]] = 1

			/**
			 * @returns {string|undefined} Set field name, if any
			 * @this Object
			 * @ignore
			 */
			return function () {
				// eslint-disable-line consistent-return
				for (var keys = Object.keys(this), i = keys.length - 1; i > -1; --i)
					if (fieldMap[keys[i]] === 1 && this[keys[i]] !== undefined && this[keys[i]] !== null) return keys[i]
			}
		}

		/**
		 * A OneOf setter as returned by {@link util.oneOfSetter}.
		 * @typedef OneOfSetter
		 * @type {function}
		 * @param {string|undefined} value Field name
		 * @returns {undefined}
		 */

		/**
		 * Builds a setter for a oneof's present field name.
		 * @param {string[]} fieldNames Field names
		 * @returns {OneOfSetter} Unbound setter
		 */
		util.oneOfSetter = function setOneOf(fieldNames) {
			/**
			 * @param {string} name Field name
			 * @returns {undefined}
			 * @this Object
			 * @ignore
			 */
			return function (name) {
				for (var i = 0; i < fieldNames.length; ++i) if (fieldNames[i] !== name) delete this[fieldNames[i]]
			}
		}

		/**
		 * Default conversion options used for {@link Message#toJSON} implementations.
		 *
		 * These options are close to proto3's JSON mapping with the exception that internal types like Any are handled just like messages. More precisely:
		 *
		 * - Longs become strings
		 * - Enums become string keys
		 * - Bytes become base64 encoded strings
		 * - (Sub-)Messages become plain objects
		 * - Maps become plain objects with all string keys
		 * - Repeated fields become arrays
		 * - NaN and Infinity for float and double fields become strings
		 *
		 * @type {IConversionOptions}
		 * @see https://developers.google.com/protocol-buffers/docs/proto3?hl=en#json
		 */
		util.toJSONOptions = {
			longs: String,
			enums: String,
			bytes: String,
			json: true,
		}

		// Sets up buffer utility according to the environment (called in index-minimal)
		util._configure = function () {
			var Buffer = util.Buffer
			/* istanbul ignore if */
			if (!Buffer) {
				util._Buffer_from = util._Buffer_allocUnsafe = null
				return
			}
			// because node 4.x buffers are incompatible & immutable
			// see: https://github.com/dcodeIO/protobuf.js/pull/665
			util._Buffer_from =
				(Buffer.from !== Uint8Array.from && Buffer.from) /* istanbul ignore next */ ||
				function Buffer_from(value, encoding) {
					return new Buffer(value, encoding)
				}
			util._Buffer_allocUnsafe =
				Buffer.allocUnsafe /* istanbul ignore next */ ||
				function Buffer_allocUnsafe(size) {
					return new Buffer(size)
				}
		}
	})(minimal)
	return minimal
}

var writer = Writer$1
var util$7 = requireMinimal()
var BufferWriter$1 // cyclic

var LongBits$1 = util$7.LongBits,
	base64 = util$7.base64,
	utf8$1 = util$7.utf8

/**
 * Constructs a new writer operation instance.
 * @classdesc Scheduled writer operation.
 * @constructor
 * @param {function(*, Uint8Array, number)} fn Function to call
 * @param {number} len Value byte length
 * @param {*} val Value to write
 * @ignore
 */
function Op(fn, len, val) {
	/**
	 * Function to call.
	 * @type {function(Uint8Array, number, *)}
	 */
	this.fn = fn

	/**
	 * Value byte length.
	 * @type {number}
	 */
	this.len = len

	/**
	 * Next operation.
	 * @type {Writer.Op|undefined}
	 */
	this.next = undefined

	/**
	 * Value to write.
	 * @type {*}
	 */
	this.val = val // type varies
}

/* istanbul ignore next */
function noop() {} // eslint-disable-line no-empty-function

/**
 * Constructs a new writer state instance.
 * @classdesc Copied writer state.
 * @memberof Writer
 * @constructor
 * @param {Writer} writer Writer to copy state from
 * @ignore
 */
function State(writer) {
	/**
	 * Current head.
	 * @type {Writer.Op}
	 */
	this.head = writer.head

	/**
	 * Current tail.
	 * @type {Writer.Op}
	 */
	this.tail = writer.tail

	/**
	 * Current buffer length.
	 * @type {number}
	 */
	this.len = writer.len

	/**
	 * Next state.
	 * @type {State|null}
	 */
	this.next = writer.states
}

/**
 * Constructs a new writer instance.
 * @classdesc Wire format writer using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 */
function Writer$1() {
	/**
	 * Current length.
	 * @type {number}
	 */
	this.len = 0

	/**
	 * Operations head.
	 * @type {Object}
	 */
	this.head = new Op(noop, 0, 0)

	/**
	 * Operations tail
	 * @type {Object}
	 */
	this.tail = this.head

	/**
	 * Linked forked states.
	 * @type {Object|null}
	 */
	this.states = null

	// When a value is written, the writer calculates its byte length and puts it into a linked
	// list of operations to perform when finish() is called. This both allows us to allocate
	// buffers of the exact required size and reduces the amount of work we have to do compared
	// to first calculating over objects and then encoding over objects. In our case, the encoding
	// part is just a linked list walk calling operations with already prepared values.
}
var create$1 = function create() {
	return util$7.Buffer
		? function create_buffer_setup() {
				return (Writer$1.create = function create_buffer() {
					return new BufferWriter$1()
				})()
			}
		: /* istanbul ignore next */ function create_array() {
				return new Writer$1()
			}
}

/**
 * Creates a new writer.
 * @function
 * @returns {BufferWriter|Writer} A {@link BufferWriter} when Buffers are supported, otherwise a {@link Writer}
 */
Writer$1.create = create$1()

/**
 * Allocates a buffer of the specified size.
 * @param {number} size Buffer size
 * @returns {Uint8Array} Buffer
 */
Writer$1.alloc = function alloc(size) {
	return new util$7.Array(size)
}

// Use Uint8Array buffer pool in the browser, just like node does with buffers
/* istanbul ignore else */
if (util$7.Array !== Array) Writer$1.alloc = util$7.pool(Writer$1.alloc, util$7.Array.prototype.subarray)

/**
 * Pushes a new operation to the queue.
 * @param {function(Uint8Array, number, *)} fn Function to call
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @returns {Writer} `this`
 * @private
 */
Writer$1.prototype._push = function push(fn, len, val) {
	this.tail = this.tail.next = new Op(fn, len, val)
	this.len += len
	return this
}
function writeByte(val, buf, pos) {
	buf[pos] = val & 255
}
function writeVarint32(val, buf, pos) {
	while (val > 127) {
		buf[pos++] = (val & 127) | 128
		val >>>= 7
	}
	buf[pos] = val
}

/**
 * Constructs a new varint writer operation instance.
 * @classdesc Scheduled varint writer operation.
 * @extends Op
 * @constructor
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @ignore
 */
function VarintOp(len, val) {
	this.len = len
	this.next = undefined
	this.val = val
}
VarintOp.prototype = Object.create(Op.prototype)
VarintOp.prototype.fn = writeVarint32

/**
 * Writes an unsigned 32 bit value as a varint.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.uint32 = function write_uint32(value) {
	// here, the call to this.push has been inlined and a varint specific Op subclass is used.
	// uint32 is by far the most frequently used operation and benefits significantly from this.
	this.len += (this.tail = this.tail.next =
		new VarintOp(
			(value = value >>> 0) < 128 ? 1 : value < 16384 ? 2 : value < 2097152 ? 3 : value < 268435456 ? 4 : 5,
			value,
		)).len
	return this
}

/**
 * Writes a signed 32 bit value as a varint.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.int32 = function write_int32(value) {
	return value < 0
		? this._push(writeVarint64, 10, LongBits$1.fromNumber(value)) // 10 bytes per spec
		: this.uint32(value)
}

/**
 * Writes a 32 bit value as a varint, zig-zag encoded.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.sint32 = function write_sint32(value) {
	return this.uint32(((value << 1) ^ (value >> 31)) >>> 0)
}
function writeVarint64(val, buf, pos) {
	while (val.hi) {
		buf[pos++] = (val.lo & 127) | 128
		val.lo = ((val.lo >>> 7) | (val.hi << 25)) >>> 0
		val.hi >>>= 7
	}
	while (val.lo > 127) {
		buf[pos++] = (val.lo & 127) | 128
		val.lo = val.lo >>> 7
	}
	buf[pos++] = val.lo
}

/**
 * Writes an unsigned 64 bit value as a varint.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer$1.prototype.uint64 = function write_uint64(value) {
	var bits = LongBits$1.from(value)
	return this._push(writeVarint64, bits.length(), bits)
}

/**
 * Writes a signed 64 bit value as a varint.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer$1.prototype.int64 = Writer$1.prototype.uint64

/**
 * Writes a signed 64 bit value as a varint, zig-zag encoded.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer$1.prototype.sint64 = function write_sint64(value) {
	var bits = LongBits$1.from(value).zzEncode()
	return this._push(writeVarint64, bits.length(), bits)
}

/**
 * Writes a boolish value as a varint.
 * @param {boolean} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.bool = function write_bool(value) {
	return this._push(writeByte, 1, value ? 1 : 0)
}
function writeFixed32(val, buf, pos) {
	buf[pos] = val & 255
	buf[pos + 1] = (val >>> 8) & 255
	buf[pos + 2] = (val >>> 16) & 255
	buf[pos + 3] = val >>> 24
}

/**
 * Writes an unsigned 32 bit value as fixed 32 bits.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.fixed32 = function write_fixed32(value) {
	return this._push(writeFixed32, 4, value >>> 0)
}

/**
 * Writes a signed 32 bit value as fixed 32 bits.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.sfixed32 = Writer$1.prototype.fixed32

/**
 * Writes an unsigned 64 bit value as fixed 64 bits.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer$1.prototype.fixed64 = function write_fixed64(value) {
	var bits = LongBits$1.from(value)
	return this._push(writeFixed32, 4, bits.lo)._push(writeFixed32, 4, bits.hi)
}

/**
 * Writes a signed 64 bit value as fixed 64 bits.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer$1.prototype.sfixed64 = Writer$1.prototype.fixed64

/**
 * Writes a float (32 bit).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.float = function write_float(value) {
	return this._push(util$7.float.writeFloatLE, 4, value)
}

/**
 * Writes a double (64 bit float).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.double = function write_double(value) {
	return this._push(util$7.float.writeDoubleLE, 8, value)
}
var writeBytes = util$7.Array.prototype.set
	? function writeBytes_set(val, buf, pos) {
			buf.set(val, pos) // also works for plain array values
		}
	: /* istanbul ignore next */ function writeBytes_for(val, buf, pos) {
			for (var i = 0; i < val.length; ++i) buf[pos + i] = val[i]
		}

/**
 * Writes a sequence of bytes.
 * @param {Uint8Array|string} value Buffer or base64 encoded string to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.bytes = function write_bytes(value) {
	var len = value.length >>> 0
	if (!len) return this._push(writeByte, 1, 0)
	if (util$7.isString(value)) {
		var buf = Writer$1.alloc((len = base64.length(value)))
		base64.decode(value, buf, 0)
		value = buf
	}
	return this.uint32(len)._push(writeBytes, len, value)
}

/**
 * Writes a string.
 * @param {string} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.string = function write_string(value) {
	var len = utf8$1.length(value)
	return len ? this.uint32(len)._push(utf8$1.write, len, value) : this._push(writeByte, 1, 0)
}

/**
 * Forks this writer's state by pushing it to a stack.
 * Calling {@link Writer#reset|reset} or {@link Writer#ldelim|ldelim} resets the writer to the previous state.
 * @returns {Writer} `this`
 */
Writer$1.prototype.fork = function fork() {
	this.states = new State(this)
	this.head = this.tail = new Op(noop, 0, 0)
	this.len = 0
	return this
}

/**
 * Resets this instance to the last state.
 * @returns {Writer} `this`
 */
Writer$1.prototype.reset = function reset() {
	if (this.states) {
		this.head = this.states.head
		this.tail = this.states.tail
		this.len = this.states.len
		this.states = this.states.next
	} else {
		this.head = this.tail = new Op(noop, 0, 0)
		this.len = 0
	}
	return this
}

/**
 * Resets to the last state and appends the fork state's current write length as a varint followed by its operations.
 * @returns {Writer} `this`
 */
Writer$1.prototype.ldelim = function ldelim() {
	var head = this.head,
		tail = this.tail,
		len = this.len
	this.reset().uint32(len)
	if (len) {
		this.tail.next = head.next // skip noop
		this.tail = tail
		this.len += len
	}
	return this
}

/**
 * Finishes the write operation.
 * @returns {Uint8Array} Finished buffer
 */
Writer$1.prototype.finish = function finish() {
	var head = this.head.next,
		// skip noop
		buf = this.constructor.alloc(this.len),
		pos = 0
	while (head) {
		head.fn(head.val, buf, pos)
		pos += head.len
		head = head.next
	}
	// this.head = this.tail = null;
	return buf
}
Writer$1._configure = function (BufferWriter_) {
	BufferWriter$1 = BufferWriter_
	Writer$1.create = create$1()
	BufferWriter$1._configure()
}

var writer_buffer = BufferWriter

// extends Writer
var Writer = writer
;(BufferWriter.prototype = Object.create(Writer.prototype)).constructor = BufferWriter
var util$6 = requireMinimal()

/**
 * Constructs a new buffer writer instance.
 * @classdesc Wire format writer using node buffers.
 * @extends Writer
 * @constructor
 */
function BufferWriter() {
	Writer.call(this)
}
BufferWriter._configure = function () {
	/**
	 * Allocates a buffer of the specified size.
	 * @function
	 * @param {number} size Buffer size
	 * @returns {Buffer} Buffer
	 */
	BufferWriter.alloc = util$6._Buffer_allocUnsafe
	BufferWriter.writeBytesBuffer =
		util$6.Buffer && util$6.Buffer.prototype instanceof Uint8Array && util$6.Buffer.prototype.set.name === 'set'
			? function writeBytesBuffer_set(val, buf, pos) {
					buf.set(val, pos) // faster than copy (requires node >= 4 where Buffers extend Uint8Array and set is properly inherited)
					// also works for plain array values
				}
			: /* istanbul ignore next */ function writeBytesBuffer_copy(val, buf, pos) {
					if (val.copy)
						// Buffer values
						val.copy(buf, pos, 0, val.length)
					else
						for (var i = 0; i < val.length; )
							// plain array values
							buf[pos++] = val[i++]
				}
}

/**
 * @override
 */
BufferWriter.prototype.bytes = function write_bytes_buffer(value) {
	if (util$6.isString(value)) value = util$6._Buffer_from(value, 'base64')
	var len = value.length >>> 0
	this.uint32(len)
	if (len) this._push(BufferWriter.writeBytesBuffer, len, value)
	return this
}
function writeStringBuffer(val, buf, pos) {
	if (val.length < 40)
		// plain js is faster for short strings (probably due to redundant assertions)
		util$6.utf8.write(val, buf, pos)
	else if (buf.utf8Write) buf.utf8Write(val, pos)
	else buf.write(val, pos)
}

/**
 * @override
 */
BufferWriter.prototype.string = function write_string_buffer(value) {
	var len = util$6.Buffer.byteLength(value)
	this.uint32(len)
	if (len) this._push(writeStringBuffer, len, value)
	return this
}

/**
 * Finishes the write operation.
 * @name BufferWriter#finish
 * @function
 * @returns {Buffer} Finished buffer
 */

BufferWriter._configure()

var reader = Reader$1
var util$5 = requireMinimal()
var BufferReader$1 // cyclic

var LongBits = util$5.LongBits,
	utf8 = util$5.utf8

/* istanbul ignore next */
function indexOutOfRange(reader, writeLength) {
	return RangeError('index out of range: ' + reader.pos + ' + ' + (writeLength || 1) + ' > ' + reader.len)
}

/**
 * Constructs a new reader instance using the specified buffer.
 * @classdesc Wire format reader using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 * @param {Uint8Array} buffer Buffer to read from
 */
function Reader$1(buffer) {
	/**
	 * Read buffer.
	 * @type {Uint8Array}
	 */
	this.buf = buffer

	/**
	 * Read buffer position.
	 * @type {number}
	 */
	this.pos = 0

	/**
	 * Read buffer length.
	 * @type {number}
	 */
	this.len = buffer.length
}
var create_array =
	typeof Uint8Array !== 'undefined'
		? function create_typed_array(buffer) {
				if (buffer instanceof Uint8Array || Array.isArray(buffer)) return new Reader$1(buffer)
				throw Error('illegal buffer')
			}
		: /* istanbul ignore next */ function create_array(buffer) {
				if (Array.isArray(buffer)) return new Reader$1(buffer)
				throw Error('illegal buffer')
			}
var create = function create() {
	return util$5.Buffer
		? function create_buffer_setup(buffer) {
				return (Reader$1.create = function create_buffer(buffer) {
					return util$5.Buffer.isBuffer(buffer)
						? new BufferReader$1(buffer)
						: /* istanbul ignore next */ create_array(buffer)
				})(buffer)
			}
		: /* istanbul ignore next */ create_array
}

/**
 * Creates a new reader using the specified buffer.
 * @function
 * @param {Uint8Array|Buffer} buffer Buffer to read from
 * @returns {Reader|BufferReader} A {@link BufferReader} if `buffer` is a Buffer, otherwise a {@link Reader}
 * @throws {Error} If `buffer` is not a valid buffer
 */
Reader$1.create = create()
Reader$1.prototype._slice = util$5.Array.prototype.subarray || /* istanbul ignore next */ util$5.Array.prototype.slice

/**
 * Reads a varint as an unsigned 32 bit value.
 * @function
 * @returns {number} Value read
 */
Reader$1.prototype.uint32 = (function read_uint32_setup() {
	var value = 4294967295 // optimizer type-hint, tends to deopt otherwise (?!)
	return function read_uint32() {
		value = (this.buf[this.pos] & 127) >>> 0
		if (this.buf[this.pos++] < 128) return value
		value = (value | ((this.buf[this.pos] & 127) << 7)) >>> 0
		if (this.buf[this.pos++] < 128) return value
		value = (value | ((this.buf[this.pos] & 127) << 14)) >>> 0
		if (this.buf[this.pos++] < 128) return value
		value = (value | ((this.buf[this.pos] & 127) << 21)) >>> 0
		if (this.buf[this.pos++] < 128) return value
		value = (value | ((this.buf[this.pos] & 15) << 28)) >>> 0
		if (this.buf[this.pos++] < 128) return value

		/* istanbul ignore if */
		if ((this.pos += 5) > this.len) {
			this.pos = this.len
			throw indexOutOfRange(this, 10)
		}
		return value
	}
})()

/**
 * Reads a varint as a signed 32 bit value.
 * @returns {number} Value read
 */
Reader$1.prototype.int32 = function read_int32() {
	return this.uint32() | 0
}

/**
 * Reads a zig-zag encoded varint as a signed 32 bit value.
 * @returns {number} Value read
 */
Reader$1.prototype.sint32 = function read_sint32() {
	var value = this.uint32()
	return ((value >>> 1) ^ -(value & 1)) | 0
}

/* eslint-disable no-invalid-this */

function readLongVarint() {
	// tends to deopt with local vars for octet etc.
	var bits = new LongBits(0, 0)
	var i = 0
	if (this.len - this.pos > 4) {
		// fast route (lo)
		for (; i < 4; ++i) {
			// 1st..4th
			bits.lo = (bits.lo | ((this.buf[this.pos] & 127) << (i * 7))) >>> 0
			if (this.buf[this.pos++] < 128) return bits
		}
		// 5th
		bits.lo = (bits.lo | ((this.buf[this.pos] & 127) << 28)) >>> 0
		bits.hi = (bits.hi | ((this.buf[this.pos] & 127) >> 4)) >>> 0
		if (this.buf[this.pos++] < 128) return bits
		i = 0
	} else {
		for (; i < 3; ++i) {
			/* istanbul ignore if */
			if (this.pos >= this.len) throw indexOutOfRange(this)
			// 1st..3th
			bits.lo = (bits.lo | ((this.buf[this.pos] & 127) << (i * 7))) >>> 0
			if (this.buf[this.pos++] < 128) return bits
		}
		// 4th
		bits.lo = (bits.lo | ((this.buf[this.pos++] & 127) << (i * 7))) >>> 0
		return bits
	}
	if (this.len - this.pos > 4) {
		// fast route (hi)
		for (; i < 5; ++i) {
			// 6th..10th
			bits.hi = (bits.hi | ((this.buf[this.pos] & 127) << (i * 7 + 3))) >>> 0
			if (this.buf[this.pos++] < 128) return bits
		}
	} else {
		for (; i < 5; ++i) {
			/* istanbul ignore if */
			if (this.pos >= this.len) throw indexOutOfRange(this)
			// 6th..10th
			bits.hi = (bits.hi | ((this.buf[this.pos] & 127) << (i * 7 + 3))) >>> 0
			if (this.buf[this.pos++] < 128) return bits
		}
	}
	/* istanbul ignore next */
	throw Error('invalid varint encoding')
}

/* eslint-enable no-invalid-this */

/**
 * Reads a varint as a signed 64 bit value.
 * @name Reader#int64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a varint as an unsigned 64 bit value.
 * @name Reader#uint64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a zig-zag encoded varint as a signed 64 bit value.
 * @name Reader#sint64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a varint as a boolean.
 * @returns {boolean} Value read
 */
Reader$1.prototype.bool = function read_bool() {
	return this.uint32() !== 0
}
function readFixed32_end(buf, end) {
	// note that this uses `end`, not `pos`
	return (buf[end - 4] | (buf[end - 3] << 8) | (buf[end - 2] << 16) | (buf[end - 1] << 24)) >>> 0
}

/**
 * Reads fixed 32 bits as an unsigned 32 bit integer.
 * @returns {number} Value read
 */
Reader$1.prototype.fixed32 = function read_fixed32() {
	/* istanbul ignore if */
	if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4)
	return readFixed32_end(this.buf, (this.pos += 4))
}

/**
 * Reads fixed 32 bits as a signed 32 bit integer.
 * @returns {number} Value read
 */
Reader$1.prototype.sfixed32 = function read_sfixed32() {
	/* istanbul ignore if */
	if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4)
	return readFixed32_end(this.buf, (this.pos += 4)) | 0
}

/* eslint-disable no-invalid-this */

function readFixed64 /* this: Reader */() {
	/* istanbul ignore if */
	if (this.pos + 8 > this.len) throw indexOutOfRange(this, 8)
	return new LongBits(readFixed32_end(this.buf, (this.pos += 4)), readFixed32_end(this.buf, (this.pos += 4)))
}

/* eslint-enable no-invalid-this */

/**
 * Reads fixed 64 bits.
 * @name Reader#fixed64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads zig-zag encoded fixed 64 bits.
 * @name Reader#sfixed64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a float (32 bit) as a number.
 * @function
 * @returns {number} Value read
 */
Reader$1.prototype.float = function read_float() {
	/* istanbul ignore if */
	if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4)
	var value = util$5.float.readFloatLE(this.buf, this.pos)
	this.pos += 4
	return value
}

/**
 * Reads a double (64 bit float) as a number.
 * @function
 * @returns {number} Value read
 */
Reader$1.prototype.double = function read_double() {
	/* istanbul ignore if */
	if (this.pos + 8 > this.len) throw indexOutOfRange(this, 4)
	var value = util$5.float.readDoubleLE(this.buf, this.pos)
	this.pos += 8
	return value
}

/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @returns {Uint8Array} Value read
 */
Reader$1.prototype.bytes = function read_bytes() {
	var length = this.uint32(),
		start = this.pos,
		end = this.pos + length

	/* istanbul ignore if */
	if (end > this.len) throw indexOutOfRange(this, length)
	this.pos += length
	if (Array.isArray(this.buf))
		// plain array
		return this.buf.slice(start, end)
	if (start === end) {
		// fix for IE 10/Win8 and others' subarray returning array of size 1
		var nativeBuffer = util$5.Buffer
		return nativeBuffer ? nativeBuffer.alloc(0) : new this.buf.constructor(0)
	}
	return this._slice.call(this.buf, start, end)
}

/**
 * Reads a string preceeded by its byte length as a varint.
 * @returns {string} Value read
 */
Reader$1.prototype.string = function read_string() {
	var bytes = this.bytes()
	return utf8.read(bytes, 0, bytes.length)
}

/**
 * Skips the specified number of bytes if specified, otherwise skips a varint.
 * @param {number} [length] Length if known, otherwise a varint is assumed
 * @returns {Reader} `this`
 */
Reader$1.prototype.skip = function skip(length) {
	if (typeof length === 'number') {
		/* istanbul ignore if */
		if (this.pos + length > this.len) throw indexOutOfRange(this, length)
		this.pos += length
	} else {
		do {
			/* istanbul ignore if */
			if (this.pos >= this.len) throw indexOutOfRange(this)
		} while (this.buf[this.pos++] & 128)
	}
	return this
}

/**
 * Skips the next element of the specified wire type.
 * @param {number} wireType Wire type received
 * @returns {Reader} `this`
 */
Reader$1.prototype.skipType = function (wireType) {
	switch (wireType) {
		case 0:
			this.skip()
			break
		case 1:
			this.skip(8)
			break
		case 2:
			this.skip(this.uint32())
			break
		case 3:
			while ((wireType = this.uint32() & 7) !== 4) {
				this.skipType(wireType)
			}
			break
		case 5:
			this.skip(4)
			break

		/* istanbul ignore next */
		default:
			throw Error('invalid wire type ' + wireType + ' at offset ' + this.pos)
	}
	return this
}
Reader$1._configure = function (BufferReader_) {
	BufferReader$1 = BufferReader_
	Reader$1.create = create()
	BufferReader$1._configure()
	var fn = util$5.Long ? 'toLong' : /* istanbul ignore next */ 'toNumber'
	util$5.merge(Reader$1.prototype, {
		int64: function read_int64() {
			return readLongVarint.call(this)[fn](false)
		},
		uint64: function read_uint64() {
			return readLongVarint.call(this)[fn](true)
		},
		sint64: function read_sint64() {
			return readLongVarint.call(this).zzDecode()[fn](false)
		},
		fixed64: function read_fixed64() {
			return readFixed64.call(this)[fn](true)
		},
		sfixed64: function read_sfixed64() {
			return readFixed64.call(this)[fn](false)
		},
	})
}

var reader_buffer = BufferReader

// extends Reader
var Reader = reader
;(BufferReader.prototype = Object.create(Reader.prototype)).constructor = BufferReader
var util$4 = requireMinimal()

/**
 * Constructs a new buffer reader instance.
 * @classdesc Wire format reader using node buffers.
 * @extends Reader
 * @constructor
 * @param {Buffer} buffer Buffer to read from
 */
function BufferReader(buffer) {
	Reader.call(this, buffer)

	/**
	 * Read buffer.
	 * @name BufferReader#buf
	 * @type {Buffer}
	 */
}
BufferReader._configure = function () {
	/* istanbul ignore else */
	if (util$4.Buffer) BufferReader.prototype._slice = util$4.Buffer.prototype.slice
}

/**
 * @override
 */
BufferReader.prototype.string = function read_string_buffer() {
	var len = this.uint32() // modifies pos
	return this.buf.utf8Slice
		? this.buf.utf8Slice(this.pos, (this.pos = Math.min(this.pos + len, this.len)))
		: this.buf.toString('utf-8', this.pos, (this.pos = Math.min(this.pos + len, this.len)))
}

/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @name BufferReader#bytes
 * @function
 * @returns {Buffer} Value read
 */

BufferReader._configure()

var rpc = {}

var service$1 = Service$1
var util$3 = requireMinimal()

// Extends EventEmitter
;(Service$1.prototype = Object.create(util$3.EventEmitter.prototype)).constructor = Service$1

/**
 * A service method callback as used by {@link rpc.ServiceMethod|ServiceMethod}.
 *
 * Differs from {@link RPCImplCallback} in that it is an actual callback of a service method which may not return `response = null`.
 * @typedef rpc.ServiceMethodCallback
 * @template TRes extends Message<TRes>
 * @type {function}
 * @param {Error|null} error Error, if any
 * @param {TRes} [response] Response message
 * @returns {undefined}
 */

/**
 * A service method part of a {@link rpc.Service} as created by {@link Service.create}.
 * @typedef rpc.ServiceMethod
 * @template TReq extends Message<TReq>
 * @template TRes extends Message<TRes>
 * @type {function}
 * @param {TReq|Properties<TReq>} request Request message or plain object
 * @param {rpc.ServiceMethodCallback<TRes>} [callback] Node-style callback called with the error, if any, and the response message
 * @returns {Promise<Message<TRes>>} Promise if `callback` has been omitted, otherwise `undefined`
 */

/**
 * Constructs a new RPC service instance.
 * @classdesc An RPC service as returned by {@link Service#create}.
 * @exports rpc.Service
 * @extends util.EventEmitter
 * @constructor
 * @param {RPCImpl} rpcImpl RPC implementation
 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
 */
function Service$1(rpcImpl, requestDelimited, responseDelimited) {
	if (typeof rpcImpl !== 'function') throw TypeError('rpcImpl must be a function')
	util$3.EventEmitter.call(this)

	/**
	 * RPC implementation. Becomes `null` once the service is ended.
	 * @type {RPCImpl|null}
	 */
	this.rpcImpl = rpcImpl

	/**
	 * Whether requests are length-delimited.
	 * @type {boolean}
	 */
	this.requestDelimited = Boolean(requestDelimited)

	/**
	 * Whether responses are length-delimited.
	 * @type {boolean}
	 */
	this.responseDelimited = Boolean(responseDelimited)
}

/**
 * Calls a service method through {@link rpc.Service#rpcImpl|rpcImpl}.
 * @param {Method|rpc.ServiceMethod<TReq,TRes>} method Reflected or static method
 * @param {Constructor<TReq>} requestCtor Request constructor
 * @param {Constructor<TRes>} responseCtor Response constructor
 * @param {TReq|Properties<TReq>} request Request message or plain object
 * @param {rpc.ServiceMethodCallback<TRes>} callback Service callback
 * @returns {undefined}
 * @template TReq extends Message<TReq>
 * @template TRes extends Message<TRes>
 */
Service$1.prototype.rpcCall = function rpcCall(method, requestCtor, responseCtor, request, callback) {
	if (!request) throw TypeError('request must be specified')
	var self = this
	if (!callback) return util$3.asPromise(rpcCall, self, method, requestCtor, responseCtor, request)
	if (!self.rpcImpl) {
		setTimeout(function () {
			callback(Error('already ended'))
		}, 0)
		return undefined
	}
	try {
		return self.rpcImpl(
			method,
			requestCtor[self.requestDelimited ? 'encodeDelimited' : 'encode'](request).finish(),
			function rpcCallback(err, response) {
				if (err) {
					self.emit('error', err, method)
					return callback(err)
				}
				if (response === null) {
					self.end(/* endedByRPC */ true)
					return undefined
				}
				if (!(response instanceof responseCtor)) {
					try {
						response = responseCtor[self.responseDelimited ? 'decodeDelimited' : 'decode'](response)
					} catch (err) {
						self.emit('error', err, method)
						return callback(err)
					}
				}
				self.emit('data', response, method)
				return callback(null, response)
			},
		)
	} catch (err) {
		self.emit('error', err, method)
		setTimeout(function () {
			callback(err)
		}, 0)
		return undefined
	}
}

/**
 * Ends this service and emits the `end` event.
 * @param {boolean} [endedByRPC=false] Whether the service has been ended by the RPC implementation.
 * @returns {rpc.Service} `this`
 */
Service$1.prototype.end = function end(endedByRPC) {
	if (this.rpcImpl) {
		if (!endedByRPC)
			// signal end to rpcImpl
			this.rpcImpl(null, null, null)
		this.rpcImpl = null
		this.emit('end').off()
	}
	return this
}
;(function (exports) {
	/**
	 * Streaming RPC helpers.
	 * @namespace
	 */
	var rpc = exports

	/**
	 * RPC implementation passed to {@link Service#create} performing a service request on network level, i.e. by utilizing http requests or websockets.
	 * @typedef RPCImpl
	 * @type {function}
	 * @param {Method|rpc.ServiceMethod<Message<{}>,Message<{}>>} method Reflected or static method being called
	 * @param {Uint8Array} requestData Request data
	 * @param {RPCImplCallback} callback Callback function
	 * @returns {undefined}
	 * @example
	 * function rpcImpl(method, requestData, callback) {
	 *     if (protobuf.util.lcFirst(method.name) !== "myMethod") // compatible with static code
	 *         throw Error("no such method");
	 *     asynchronouslyObtainAResponse(requestData, function(err, responseData) {
	 *         callback(err, responseData);
	 *     });
	 * }
	 */

	/**
	 * Node-style callback as used by {@link RPCImpl}.
	 * @typedef RPCImplCallback
	 * @type {function}
	 * @param {Error|null} error Error, if any, otherwise `null`
	 * @param {Uint8Array|null} [response] Response data or `null` to signal end of stream, if there hasn't been an error
	 * @returns {undefined}
	 */

	rpc.Service = service$1
})(rpc)

var roots = {}

;(function (exports) {
	var protobuf = exports

	/**
	 * Build type, one of `"full"`, `"light"` or `"minimal"`.
	 * @name build
	 * @type {string}
	 * @const
	 */
	protobuf.build = 'minimal'

	// Serialization
	protobuf.Writer = writer
	protobuf.BufferWriter = writer_buffer
	protobuf.Reader = reader
	protobuf.BufferReader = reader_buffer

	// Utility
	protobuf.util = requireMinimal()
	protobuf.rpc = rpc
	protobuf.roots = roots
	protobuf.configure = configure

	/* istanbul ignore next */
	/**
	 * Reconfigures the library according to the environment.
	 * @returns {undefined}
	 */
	function configure() {
		protobuf.util._configure()
		protobuf.Writer._configure(protobuf.BufferWriter)
		protobuf.Reader._configure(protobuf.BufferReader)
	}

	// Set up buffer utility according to the environment
	configure()
})(indexMinimal)

var util$2 = { exports: {} }

var codegen_1
var hasRequiredCodegen
function requireCodegen() {
	if (hasRequiredCodegen) return codegen_1
	hasRequiredCodegen = 1
	codegen_1 = codegen

	/**
	 * Begins generating a function.
	 * @memberof util
	 * @param {string[]} functionParams Function parameter names
	 * @param {string} [functionName] Function name if not anonymous
	 * @returns {Codegen} Appender that appends code to the function's body
	 */
	function codegen(functionParams, functionName) {
		/* istanbul ignore if */
		if (typeof functionParams === 'string') {
			functionName = functionParams
			functionParams = undefined
		}
		var body = []

		/**
		 * Appends code to the function's body or finishes generation.
		 * @typedef Codegen
		 * @type {function}
		 * @param {string|Object.<string,*>} [formatStringOrScope] Format string or, to finish the function, an object of additional scope variables, if any
		 * @param {...*} [formatParams] Format parameters
		 * @returns {Codegen|Function} Itself or the generated function if finished
		 * @throws {Error} If format parameter counts do not match
		 */

		function Codegen(formatStringOrScope) {
			// note that explicit array handling below makes this ~50% faster

			// finish the function
			if (typeof formatStringOrScope !== 'string') {
				var source = toString()
				if (codegen.verbose) console.log('codegen: ' + source) // eslint-disable-line no-console
				source = 'return ' + source
				if (formatStringOrScope) {
					var scopeKeys = Object.keys(formatStringOrScope),
						scopeParams = new Array(scopeKeys.length + 1),
						scopeValues = new Array(scopeKeys.length),
						scopeOffset = 0
					while (scopeOffset < scopeKeys.length) {
						scopeParams[scopeOffset] = scopeKeys[scopeOffset]
						scopeValues[scopeOffset] = formatStringOrScope[scopeKeys[scopeOffset++]]
					}
					scopeParams[scopeOffset] = source
					return Function.apply(null, scopeParams).apply(null, scopeValues) // eslint-disable-line no-new-func
				}
				return Function(source)() // eslint-disable-line no-new-func
			}

			// otherwise append to body
			var formatParams = new Array(arguments.length - 1),
				formatOffset = 0
			while (formatOffset < formatParams.length) formatParams[formatOffset] = arguments[++formatOffset]
			formatOffset = 0
			formatStringOrScope = formatStringOrScope.replace(/%([%dfijs])/g, function replace($0, $1) {
				var value = formatParams[formatOffset++]
				switch ($1) {
					case 'd':
					case 'f':
						return String(Number(value))
					case 'i':
						return String(Math.floor(value))
					case 'j':
						return JSON.stringify(value)
					case 's':
						return String(value)
				}
				return '%'
			})
			if (formatOffset !== formatParams.length) throw Error('parameter count mismatch')
			body.push(formatStringOrScope)
			return Codegen
		}
		function toString(functionNameOverride) {
			return (
				'function ' +
				(functionNameOverride || functionName || '') +
				'(' +
				((functionParams && functionParams.join(',')) || '') +
				'){\n  ' +
				body.join('\n  ') +
				'\n}'
			)
		}
		Codegen.toString = toString
		return Codegen
	}

	/**
	 * Begins generating a function.
	 * @memberof util
	 * @function codegen
	 * @param {string} [functionName] Function name if not anonymous
	 * @returns {Codegen} Appender that appends code to the function's body
	 * @variation 2
	 */

	/**
	 * When set to `true`, codegen will log generated code to console. Useful for debugging.
	 * @name util.codegen.verbose
	 * @type {boolean}
	 */
	codegen.verbose = false
	return codegen_1
}

var fetch_1
var hasRequiredFetch
function requireFetch() {
	if (hasRequiredFetch) return fetch_1
	hasRequiredFetch = 1
	fetch_1 = fetch
	var asPromise = requireAspromise(),
		inquire = requireInquire()
	var fs = inquire('fs')

	/**
	 * Node-style callback as used by {@link util.fetch}.
	 * @typedef FetchCallback
	 * @type {function}
	 * @param {?Error} error Error, if any, otherwise `null`
	 * @param {string} [contents] File contents, if there hasn't been an error
	 * @returns {undefined}
	 */

	/**
	 * Options as used by {@link util.fetch}.
	 * @typedef FetchOptions
	 * @type {Object}
	 * @property {boolean} [binary=false] Whether expecting a binary response
	 * @property {boolean} [xhr=false] If `true`, forces the use of XMLHttpRequest
	 */

	/**
	 * Fetches the contents of a file.
	 * @memberof util
	 * @param {string} filename File path or url
	 * @param {FetchOptions} options Fetch options
	 * @param {FetchCallback} callback Callback function
	 * @returns {undefined}
	 */
	function fetch(filename, options, callback) {
		if (typeof options === 'function') {
			callback = options
			options = {}
		} else if (!options) options = {}
		if (!callback) return asPromise(fetch, this, filename, options) // eslint-disable-line no-invalid-this

		// if a node-like filesystem is present, try it first but fall back to XHR if nothing is found.
		if (!options.xhr && fs && fs.readFile)
			return fs.readFile(filename, function fetchReadFileCallback(err, contents) {
				return err && typeof XMLHttpRequest !== 'undefined'
					? fetch.xhr(filename, options, callback)
					: err
						? callback(err)
						: callback(null, options.binary ? contents : contents.toString('utf8'))
			})

		// use the XHR version otherwise.
		return fetch.xhr(filename, options, callback)
	}

	/**
	 * Fetches the contents of a file.
	 * @name util.fetch
	 * @function
	 * @param {string} path File path or url
	 * @param {FetchCallback} callback Callback function
	 * @returns {undefined}
	 * @variation 2
	 */

	/**
	 * Fetches the contents of a file.
	 * @name util.fetch
	 * @function
	 * @param {string} path File path or url
	 * @param {FetchOptions} [options] Fetch options
	 * @returns {Promise<string|Uint8Array>} Promise
	 * @variation 3
	 */

	/**/
	fetch.xhr = function fetch_xhr(filename, options, callback) {
		var xhr = new XMLHttpRequest()
		xhr.onreadystatechange /* works everywhere */ = function fetchOnReadyStateChange() {
			if (xhr.readyState !== 4) return undefined

			// local cors security errors return status 0 / empty string, too. afaik this cannot be
			// reliably distinguished from an actually empty file for security reasons. feel free
			// to send a pull request if you are aware of a solution.
			if (xhr.status !== 0 && xhr.status !== 200) return callback(Error('status ' + xhr.status))

			// if binary data is expected, make sure that some sort of array is returned, even if
			// ArrayBuffers are not supported. the binary string fallback, however, is unsafe.
			if (options.binary) {
				var buffer = xhr.response
				if (!buffer) {
					buffer = []
					for (var i = 0; i < xhr.responseText.length; ++i) buffer.push(xhr.responseText.charCodeAt(i) & 255)
				}
				return callback(null, typeof Uint8Array !== 'undefined' ? new Uint8Array(buffer) : buffer)
			}
			return callback(null, xhr.responseText)
		}
		if (options.binary) {
			// ref: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Sending_and_Receiving_Binary_Data#Receiving_binary_data_in_older_browsers
			if ('overrideMimeType' in xhr) xhr.overrideMimeType('text/plain; charset=x-user-defined')
			xhr.responseType = 'arraybuffer'
		}
		xhr.open('GET', filename)
		xhr.send()
	}
	return fetch_1
}

var path = {}

var hasRequiredPath
function requirePath() {
	if (hasRequiredPath) return path
	hasRequiredPath = 1
	;(function (exports) {
		/**
		 * A minimal path module to resolve Unix, Windows and URL paths alike.
		 * @memberof util
		 * @namespace
		 */
		var path = exports
		var isAbsolute =
			/**
			 * Tests if the specified path is absolute.
			 * @param {string} path Path to test
			 * @returns {boolean} `true` if path is absolute
			 */
			(path.isAbsolute = function isAbsolute(path) {
				return /^(?:\/|\w+:)/.test(path)
			})
		var normalize =
			/**
			 * Normalizes the specified path.
			 * @param {string} path Path to normalize
			 * @returns {string} Normalized path
			 */
			(path.normalize = function normalize(path) {
				path = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
				var parts = path.split('/'),
					absolute = isAbsolute(path),
					prefix = ''
				if (absolute) prefix = parts.shift() + '/'
				for (var i = 0; i < parts.length; ) {
					if (parts[i] === '..') {
						if (i > 0 && parts[i - 1] !== '..') parts.splice(--i, 2)
						else if (absolute) parts.splice(i, 1)
						else ++i
					} else if (parts[i] === '.') parts.splice(i, 1)
					else ++i
				}
				return prefix + parts.join('/')
			})

		/**
		 * Resolves the specified include path against the specified origin path.
		 * @param {string} originPath Path to the origin file
		 * @param {string} includePath Include path relative to origin path
		 * @param {boolean} [alreadyNormalized=false] `true` if both paths are already known to be normalized
		 * @returns {string} Path to the include file
		 */
		path.resolve = function resolve(originPath, includePath, alreadyNormalized) {
			if (!alreadyNormalized) includePath = normalize(includePath)
			if (isAbsolute(includePath)) return includePath
			if (!alreadyNormalized) originPath = normalize(originPath)
			return (originPath = originPath.replace(/(?:\/|^)[^/]+$/, '')).length
				? normalize(originPath + '/' + includePath)
				: includePath
		}
	})(path)
	return path
}

var types$1 = {}

var hasRequiredTypes
function requireTypes() {
	if (hasRequiredTypes) return types$1
	hasRequiredTypes = 1
	;(function (exports) {
		/**
		 * Common type constants.
		 * @namespace
		 */
		var types = exports
		var util = requireUtil()
		var s = [
			'double',
			// 0
			'float',
			// 1
			'int32',
			// 2
			'uint32',
			// 3
			'sint32',
			// 4
			'fixed32',
			// 5
			'sfixed32',
			// 6
			'int64',
			// 7
			'uint64',
			// 8
			'sint64',
			// 9
			'fixed64',
			// 10
			'sfixed64',
			// 11
			'bool',
			// 12
			'string',
			// 13
			'bytes', // 14
		]
		function bake(values, offset) {
			var i = 0,
				o = {}
			offset |= 0
			while (i < values.length) o[s[i + offset]] = values[i++]
			return o
		}

		/**
		 * Basic type wire types.
		 * @type {Object.<string,number>}
		 * @const
		 * @property {number} double=1 Fixed64 wire type
		 * @property {number} float=5 Fixed32 wire type
		 * @property {number} int32=0 Varint wire type
		 * @property {number} uint32=0 Varint wire type
		 * @property {number} sint32=0 Varint wire type
		 * @property {number} fixed32=5 Fixed32 wire type
		 * @property {number} sfixed32=5 Fixed32 wire type
		 * @property {number} int64=0 Varint wire type
		 * @property {number} uint64=0 Varint wire type
		 * @property {number} sint64=0 Varint wire type
		 * @property {number} fixed64=1 Fixed64 wire type
		 * @property {number} sfixed64=1 Fixed64 wire type
		 * @property {number} bool=0 Varint wire type
		 * @property {number} string=2 Ldelim wire type
		 * @property {number} bytes=2 Ldelim wire type
		 */
		types.basic = bake([
			/* double   */ 1, /* float    */ 5, /* int32    */ 0, /* uint32   */ 0, /* sint32   */ 0, /* fixed32  */ 5,
			/* sfixed32 */ 5, /* int64    */ 0, /* uint64   */ 0, /* sint64   */ 0, /* fixed64  */ 1, /* sfixed64 */ 1,
			/* bool     */ 0, /* string   */ 2, /* bytes    */ 2,
		])

		/**
		 * Basic type defaults.
		 * @type {Object.<string,*>}
		 * @const
		 * @property {number} double=0 Double default
		 * @property {number} float=0 Float default
		 * @property {number} int32=0 Int32 default
		 * @property {number} uint32=0 Uint32 default
		 * @property {number} sint32=0 Sint32 default
		 * @property {number} fixed32=0 Fixed32 default
		 * @property {number} sfixed32=0 Sfixed32 default
		 * @property {number} int64=0 Int64 default
		 * @property {number} uint64=0 Uint64 default
		 * @property {number} sint64=0 Sint32 default
		 * @property {number} fixed64=0 Fixed64 default
		 * @property {number} sfixed64=0 Sfixed64 default
		 * @property {boolean} bool=false Bool default
		 * @property {string} string="" String default
		 * @property {Array.<number>} bytes=Array(0) Bytes default
		 * @property {null} message=null Message default
		 */
		types.defaults = bake([
			/* double   */ 0,
			/* float    */ 0,
			/* int32    */ 0,
			/* uint32   */ 0,
			/* sint32   */ 0,
			/* fixed32  */ 0,
			/* sfixed32 */ 0,
			/* int64    */ 0,
			/* uint64   */ 0,
			/* sint64   */ 0,
			/* fixed64  */ 0,
			/* sfixed64 */ 0,
			/* bool     */ false,
			/* string   */ '',
			/* bytes    */ util.emptyArray,
			/* message  */ null,
		])

		/**
		 * Basic long type wire types.
		 * @type {Object.<string,number>}
		 * @const
		 * @property {number} int64=0 Varint wire type
		 * @property {number} uint64=0 Varint wire type
		 * @property {number} sint64=0 Varint wire type
		 * @property {number} fixed64=1 Fixed64 wire type
		 * @property {number} sfixed64=1 Fixed64 wire type
		 */
		types.long = bake([/* int64    */ 0, /* uint64   */ 0, /* sint64   */ 0, /* fixed64  */ 1, /* sfixed64 */ 1], 7)

		/**
		 * Allowed types for map keys with their associated wire type.
		 * @type {Object.<string,number>}
		 * @const
		 * @property {number} int32=0 Varint wire type
		 * @property {number} uint32=0 Varint wire type
		 * @property {number} sint32=0 Varint wire type
		 * @property {number} fixed32=5 Fixed32 wire type
		 * @property {number} sfixed32=5 Fixed32 wire type
		 * @property {number} int64=0 Varint wire type
		 * @property {number} uint64=0 Varint wire type
		 * @property {number} sint64=0 Varint wire type
		 * @property {number} fixed64=1 Fixed64 wire type
		 * @property {number} sfixed64=1 Fixed64 wire type
		 * @property {number} bool=0 Varint wire type
		 * @property {number} string=2 Ldelim wire type
		 */
		types.mapKey = bake(
			[
				/* int32    */ 0, /* uint32   */ 0, /* sint32   */ 0, /* fixed32  */ 5, /* sfixed32 */ 5, /* int64    */ 0,
				/* uint64   */ 0, /* sint64   */ 0, /* fixed64  */ 1, /* sfixed64 */ 1, /* bool     */ 0, /* string   */ 2,
			],
			2,
		)

		/**
		 * Allowed types for packed repeated fields with their associated wire type.
		 * @type {Object.<string,number>}
		 * @const
		 * @property {number} double=1 Fixed64 wire type
		 * @property {number} float=5 Fixed32 wire type
		 * @property {number} int32=0 Varint wire type
		 * @property {number} uint32=0 Varint wire type
		 * @property {number} sint32=0 Varint wire type
		 * @property {number} fixed32=5 Fixed32 wire type
		 * @property {number} sfixed32=5 Fixed32 wire type
		 * @property {number} int64=0 Varint wire type
		 * @property {number} uint64=0 Varint wire type
		 * @property {number} sint64=0 Varint wire type
		 * @property {number} fixed64=1 Fixed64 wire type
		 * @property {number} sfixed64=1 Fixed64 wire type
		 * @property {number} bool=0 Varint wire type
		 */
		types.packed = bake([
			/* double   */ 1, /* float    */ 5, /* int32    */ 0, /* uint32   */ 0, /* sint32   */ 0, /* fixed32  */ 5,
			/* sfixed32 */ 5, /* int64    */ 0, /* uint64   */ 0, /* sint64   */ 0, /* fixed64  */ 1, /* sfixed64 */ 1,
			/* bool     */ 0,
		])
	})(types$1)
	return types$1
}

var field
var hasRequiredField
function requireField() {
	if (hasRequiredField) return field
	hasRequiredField = 1
	field = Field

	// extends ReflectionObject
	var ReflectionObject = requireObject()
	;((Field.prototype = Object.create(ReflectionObject.prototype)).constructor = Field).className = 'Field'
	var Enum = require_enum(),
		types = requireTypes(),
		util = requireUtil()
	var Type // cyclic

	var ruleRe = /^required|optional|repeated$/

	/**
	 * Constructs a new message field instance. Note that {@link MapField|map fields} have their own class.
	 * @name Field
	 * @classdesc Reflected message field.
	 * @extends FieldBase
	 * @constructor
	 * @param {string} name Unique name within its namespace
	 * @param {number} id Unique id within its namespace
	 * @param {string} type Value type
	 * @param {string|Object.<string,*>} [rule="optional"] Field rule
	 * @param {string|Object.<string,*>} [extend] Extended type if different from parent
	 * @param {Object.<string,*>} [options] Declared options
	 */

	/**
	 * Constructs a field from a field descriptor.
	 * @param {string} name Field name
	 * @param {IField} json Field descriptor
	 * @returns {Field} Created field
	 * @throws {TypeError} If arguments are invalid
	 */
	Field.fromJSON = function fromJSON(name, json) {
		return new Field(name, json.id, json.type, json.rule, json.extend, json.options, json.comment)
	}

	/**
	 * Not an actual constructor. Use {@link Field} instead.
	 * @classdesc Base class of all reflected message fields. This is not an actual class but here for the sake of having consistent type definitions.
	 * @exports FieldBase
	 * @extends ReflectionObject
	 * @constructor
	 * @param {string} name Unique name within its namespace
	 * @param {number} id Unique id within its namespace
	 * @param {string} type Value type
	 * @param {string|Object.<string,*>} [rule="optional"] Field rule
	 * @param {string|Object.<string,*>} [extend] Extended type if different from parent
	 * @param {Object.<string,*>} [options] Declared options
	 * @param {string} [comment] Comment associated with this field
	 */
	function Field(name, id, type, rule, extend, options, comment) {
		if (util.isObject(rule)) {
			comment = extend
			options = rule
			rule = extend = undefined
		} else if (util.isObject(extend)) {
			comment = options
			options = extend
			extend = undefined
		}
		ReflectionObject.call(this, name, options)
		if (!util.isInteger(id) || id < 0) throw TypeError('id must be a non-negative integer')
		if (!util.isString(type)) throw TypeError('type must be a string')
		if (rule !== undefined && !ruleRe.test((rule = rule.toString().toLowerCase())))
			throw TypeError('rule must be a string rule')
		if (extend !== undefined && !util.isString(extend)) throw TypeError('extend must be a string')

		/**
		 * Field rule, if any.
		 * @type {string|undefined}
		 */
		if (rule === 'proto3_optional') {
			rule = 'optional'
		}
		this.rule = rule && rule !== 'optional' ? rule : undefined // toJSON

		/**
		 * Field type.
		 * @type {string}
		 */
		this.type = type // toJSON

		/**
		 * Unique field id.
		 * @type {number}
		 */
		this.id = id // toJSON, marker

		/**
		 * Extended type if different from parent.
		 * @type {string|undefined}
		 */
		this.extend = extend || undefined // toJSON

		/**
		 * Whether this field is required.
		 * @type {boolean}
		 */
		this.required = rule === 'required'

		/**
		 * Whether this field is optional.
		 * @type {boolean}
		 */
		this.optional = !this.required

		/**
		 * Whether this field is repeated.
		 * @type {boolean}
		 */
		this.repeated = rule === 'repeated'

		/**
		 * Whether this field is a map or not.
		 * @type {boolean}
		 */
		this.map = false

		/**
		 * Message this field belongs to.
		 * @type {Type|null}
		 */
		this.message = null

		/**
		 * OneOf this field belongs to, if any,
		 * @type {OneOf|null}
		 */
		this.partOf = null

		/**
		 * The field type's default value.
		 * @type {*}
		 */
		this.typeDefault = null

		/**
		 * The field's default value on prototypes.
		 * @type {*}
		 */
		this.defaultValue = null

		/**
		 * Whether this field's value should be treated as a long.
		 * @type {boolean}
		 */
		this.long = util.Long ? types.long[type] !== undefined : /* istanbul ignore next */ false

		/**
		 * Whether this field's value is a buffer.
		 * @type {boolean}
		 */
		this.bytes = type === 'bytes'

		/**
		 * Resolved type if not a basic type.
		 * @type {Type|Enum|null}
		 */
		this.resolvedType = null

		/**
		 * Sister-field within the extended type if a declaring extension field.
		 * @type {Field|null}
		 */
		this.extensionField = null

		/**
		 * Sister-field within the declaring namespace if an extended field.
		 * @type {Field|null}
		 */
		this.declaringField = null

		/**
		 * Internally remembers whether this field is packed.
		 * @type {boolean|null}
		 * @private
		 */
		this._packed = null

		/**
		 * Comment for this field.
		 * @type {string|null}
		 */
		this.comment = comment
	}

	/**
	 * Determines whether this field is packed. Only relevant when repeated and working with proto2.
	 * @name Field#packed
	 * @type {boolean}
	 * @readonly
	 */
	Object.defineProperty(Field.prototype, 'packed', {
		get: function () {
			// defaults to packed=true if not explicity set to false
			if (this._packed === null) this._packed = this.getOption('packed') !== false
			return this._packed
		},
	})

	/**
	 * @override
	 */
	Field.prototype.setOption = function setOption(name, value, ifNotSet) {
		if (name === 'packed')
			// clear cached before setting
			this._packed = null
		return ReflectionObject.prototype.setOption.call(this, name, value, ifNotSet)
	}

	/**
	 * Field descriptor.
	 * @interface IField
	 * @property {string} [rule="optional"] Field rule
	 * @property {string} type Field type
	 * @property {number} id Field id
	 * @property {Object.<string,*>} [options] Field options
	 */

	/**
	 * Extension field descriptor.
	 * @interface IExtensionField
	 * @extends IField
	 * @property {string} extend Extended type
	 */

	/**
	 * Converts this field to a field descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IField} Field descriptor
	 */
	Field.prototype.toJSON = function toJSON(toJSONOptions) {
		var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false
		return util.toObject([
			'rule',
			(this.rule !== 'optional' && this.rule) || undefined,
			'type',
			this.type,
			'id',
			this.id,
			'extend',
			this.extend,
			'options',
			this.options,
			'comment',
			keepComments ? this.comment : undefined,
		])
	}

	/**
	 * Resolves this field's type references.
	 * @returns {Field} `this`
	 * @throws {Error} If any reference cannot be resolved
	 */
	Field.prototype.resolve = function resolve() {
		if (this.resolved) return this
		if ((this.typeDefault = types.defaults[this.type]) === undefined) {
			// if not a basic type, resolve it
			this.resolvedType = (this.declaringField ? this.declaringField.parent : this.parent).lookupTypeOrEnum(this.type)
			if (this.resolvedType instanceof Type) this.typeDefault = null
			// instanceof Enum
			else this.typeDefault = this.resolvedType.values[Object.keys(this.resolvedType.values)[0]] // first defined
		} else if (this.options && this.options.proto3_optional) {
			// proto3 scalar value marked optional; should default to null
			this.typeDefault = null
		}

		// use explicitly set default value if present
		if (this.options && this.options['default'] != null) {
			this.typeDefault = this.options['default']
			if (this.resolvedType instanceof Enum && typeof this.typeDefault === 'string')
				this.typeDefault = this.resolvedType.values[this.typeDefault]
		}

		// remove unnecessary options
		if (this.options) {
			if (
				this.options.packed === true ||
				(this.options.packed !== undefined && this.resolvedType && !(this.resolvedType instanceof Enum))
			)
				delete this.options.packed
			if (!Object.keys(this.options).length) this.options = undefined
		}

		// convert to internal data type if necesssary
		if (this.long) {
			this.typeDefault = util.Long.fromNumber(this.typeDefault, this.type.charAt(0) === 'u')

			/* istanbul ignore else */
			if (Object.freeze) Object.freeze(this.typeDefault) // long instances are meant to be immutable anyway (i.e. use small int cache that even requires it)
		} else if (this.bytes && typeof this.typeDefault === 'string') {
			var buf
			if (util.base64.test(this.typeDefault))
				util.base64.decode(this.typeDefault, (buf = util.newBuffer(util.base64.length(this.typeDefault))), 0)
			else util.utf8.write(this.typeDefault, (buf = util.newBuffer(util.utf8.length(this.typeDefault))), 0)
			this.typeDefault = buf
		}

		// take special care of maps and repeated fields
		if (this.map) this.defaultValue = util.emptyObject
		else if (this.repeated) this.defaultValue = util.emptyArray
		else this.defaultValue = this.typeDefault

		// ensure proper value on prototype
		if (this.parent instanceof Type) this.parent.ctor.prototype[this.name] = this.defaultValue
		return ReflectionObject.prototype.resolve.call(this)
	}

	/**
	 * Decorator function as returned by {@link Field.d} and {@link MapField.d} (TypeScript).
	 * @typedef FieldDecorator
	 * @type {function}
	 * @param {Object} prototype Target prototype
	 * @param {string} fieldName Field name
	 * @returns {undefined}
	 */

	/**
	 * Field decorator (TypeScript).
	 * @name Field.d
	 * @function
	 * @param {number} fieldId Field id
	 * @param {"double"|"float"|"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"string"|"bool"|"bytes"|Object} fieldType Field type
	 * @param {"optional"|"required"|"repeated"} [fieldRule="optional"] Field rule
	 * @param {T} [defaultValue] Default value
	 * @returns {FieldDecorator} Decorator function
	 * @template T extends number | number[] | Long | Long[] | string | string[] | boolean | boolean[] | Uint8Array | Uint8Array[] | Buffer | Buffer[]
	 */
	Field.d = function decorateField(fieldId, fieldType, fieldRule, defaultValue) {
		// submessage: decorate the submessage and use its name as the type
		if (typeof fieldType === 'function') fieldType = util.decorateType(fieldType).name
		// enum reference: create a reflected copy of the enum and keep reuseing it
		else if (fieldType && typeof fieldType === 'object') fieldType = util.decorateEnum(fieldType).name
		return function fieldDecorator(prototype, fieldName) {
			util.decorateType(prototype.constructor).add(
				new Field(fieldName, fieldId, fieldType, fieldRule, {
					default: defaultValue,
				}),
			)
		}
	}

	/**
	 * Field decorator (TypeScript).
	 * @name Field.d
	 * @function
	 * @param {number} fieldId Field id
	 * @param {Constructor<T>|string} fieldType Field type
	 * @param {"optional"|"required"|"repeated"} [fieldRule="optional"] Field rule
	 * @returns {FieldDecorator} Decorator function
	 * @template T extends Message<T>
	 * @variation 2
	 */
	// like Field.d but without a default value

	// Sets up cyclic dependencies (called in index-light)
	Field._configure = function configure(Type_) {
		Type = Type_
	}
	return field
}

var oneof
var hasRequiredOneof
function requireOneof() {
	if (hasRequiredOneof) return oneof
	hasRequiredOneof = 1
	oneof = OneOf

	// extends ReflectionObject
	var ReflectionObject = requireObject()
	;((OneOf.prototype = Object.create(ReflectionObject.prototype)).constructor = OneOf).className = 'OneOf'
	var Field = requireField(),
		util = requireUtil()

	/**
	 * Constructs a new oneof instance.
	 * @classdesc Reflected oneof.
	 * @extends ReflectionObject
	 * @constructor
	 * @param {string} name Oneof name
	 * @param {string[]|Object.<string,*>} [fieldNames] Field names
	 * @param {Object.<string,*>} [options] Declared options
	 * @param {string} [comment] Comment associated with this field
	 */
	function OneOf(name, fieldNames, options, comment) {
		if (!Array.isArray(fieldNames)) {
			options = fieldNames
			fieldNames = undefined
		}
		ReflectionObject.call(this, name, options)

		/* istanbul ignore if */
		if (!(fieldNames === undefined || Array.isArray(fieldNames))) throw TypeError('fieldNames must be an Array')

		/**
		 * Field names that belong to this oneof.
		 * @type {string[]}
		 */
		this.oneof = fieldNames || [] // toJSON, marker

		/**
		 * Fields that belong to this oneof as an array for iteration.
		 * @type {Field[]}
		 * @readonly
		 */
		this.fieldsArray = [] // declared readonly for conformance, possibly not yet added to parent

		/**
		 * Comment for this field.
		 * @type {string|null}
		 */
		this.comment = comment
	}

	/**
	 * Oneof descriptor.
	 * @interface IOneOf
	 * @property {Array.<string>} oneof Oneof field names
	 * @property {Object.<string,*>} [options] Oneof options
	 */

	/**
	 * Constructs a oneof from a oneof descriptor.
	 * @param {string} name Oneof name
	 * @param {IOneOf} json Oneof descriptor
	 * @returns {OneOf} Created oneof
	 * @throws {TypeError} If arguments are invalid
	 */
	OneOf.fromJSON = function fromJSON(name, json) {
		return new OneOf(name, json.oneof, json.options, json.comment)
	}

	/**
	 * Converts this oneof to a oneof descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IOneOf} Oneof descriptor
	 */
	OneOf.prototype.toJSON = function toJSON(toJSONOptions) {
		var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false
		return util.toObject([
			'options',
			this.options,
			'oneof',
			this.oneof,
			'comment',
			keepComments ? this.comment : undefined,
		])
	}

	/**
	 * Adds the fields of the specified oneof to the parent if not already done so.
	 * @param {OneOf} oneof The oneof
	 * @returns {undefined}
	 * @inner
	 * @ignore
	 */
	function addFieldsToParent(oneof) {
		if (oneof.parent)
			for (var i = 0; i < oneof.fieldsArray.length; ++i)
				if (!oneof.fieldsArray[i].parent) oneof.parent.add(oneof.fieldsArray[i])
	}

	/**
	 * Adds a field to this oneof and removes it from its current parent, if any.
	 * @param {Field} field Field to add
	 * @returns {OneOf} `this`
	 */
	OneOf.prototype.add = function add(field) {
		/* istanbul ignore if */
		if (!(field instanceof Field)) throw TypeError('field must be a Field')
		if (field.parent && field.parent !== this.parent) field.parent.remove(field)
		this.oneof.push(field.name)
		this.fieldsArray.push(field)
		field.partOf = this // field.parent remains null
		addFieldsToParent(this)
		return this
	}

	/**
	 * Removes a field from this oneof and puts it back to the oneof's parent.
	 * @param {Field} field Field to remove
	 * @returns {OneOf} `this`
	 */
	OneOf.prototype.remove = function remove(field) {
		/* istanbul ignore if */
		if (!(field instanceof Field)) throw TypeError('field must be a Field')
		var index = this.fieldsArray.indexOf(field)

		/* istanbul ignore if */
		if (index < 0) throw Error(field + ' is not a member of ' + this)
		this.fieldsArray.splice(index, 1)
		index = this.oneof.indexOf(field.name)

		/* istanbul ignore else */
		if (index > -1)
			// theoretical
			this.oneof.splice(index, 1)
		field.partOf = null
		return this
	}

	/**
	 * @override
	 */
	OneOf.prototype.onAdd = function onAdd(parent) {
		ReflectionObject.prototype.onAdd.call(this, parent)
		var self = this
		// Collect present fields
		for (var i = 0; i < this.oneof.length; ++i) {
			var field = parent.get(this.oneof[i])
			if (field && !field.partOf) {
				field.partOf = self
				self.fieldsArray.push(field)
			}
		}
		// Add not yet present fields
		addFieldsToParent(this)
	}

	/**
	 * @override
	 */
	OneOf.prototype.onRemove = function onRemove(parent) {
		for (var i = 0, field; i < this.fieldsArray.length; ++i)
			if ((field = this.fieldsArray[i]).parent) field.parent.remove(field)
		ReflectionObject.prototype.onRemove.call(this, parent)
	}

	/**
	 * Decorator function as returned by {@link OneOf.d} (TypeScript).
	 * @typedef OneOfDecorator
	 * @type {function}
	 * @param {Object} prototype Target prototype
	 * @param {string} oneofName OneOf name
	 * @returns {undefined}
	 */

	/**
	 * OneOf decorator (TypeScript).
	 * @function
	 * @param {...string} fieldNames Field names
	 * @returns {OneOfDecorator} Decorator function
	 * @template T extends string
	 */
	OneOf.d = function decorateOneOf() {
		var fieldNames = new Array(arguments.length),
			index = 0
		while (index < arguments.length) fieldNames[index] = arguments[index++]
		return function oneOfDecorator(prototype, oneofName) {
			util.decorateType(prototype.constructor).add(new OneOf(oneofName, fieldNames))
			Object.defineProperty(prototype, oneofName, {
				get: util.oneOfGetter(fieldNames),
				set: util.oneOfSetter(fieldNames),
			})
		}
	}
	return oneof
}

var namespace
var hasRequiredNamespace
function requireNamespace() {
	if (hasRequiredNamespace) return namespace
	hasRequiredNamespace = 1
	namespace = Namespace

	// extends ReflectionObject
	var ReflectionObject = requireObject()
	;((Namespace.prototype = Object.create(ReflectionObject.prototype)).constructor = Namespace).className = 'Namespace'
	var Field = requireField(),
		util = requireUtil(),
		OneOf = requireOneof()
	var Type,
		// cyclic
		Service,
		Enum

	/**
	 * Constructs a new namespace instance.
	 * @name Namespace
	 * @classdesc Reflected namespace.
	 * @extends NamespaceBase
	 * @constructor
	 * @param {string} name Namespace name
	 * @param {Object.<string,*>} [options] Declared options
	 */

	/**
	 * Constructs a namespace from JSON.
	 * @memberof Namespace
	 * @function
	 * @param {string} name Namespace name
	 * @param {Object.<string,*>} json JSON object
	 * @returns {Namespace} Created namespace
	 * @throws {TypeError} If arguments are invalid
	 */
	Namespace.fromJSON = function fromJSON(name, json) {
		return new Namespace(name, json.options).addJSON(json.nested)
	}

	/**
	 * Converts an array of reflection objects to JSON.
	 * @memberof Namespace
	 * @param {ReflectionObject[]} array Object array
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {Object.<string,*>|undefined} JSON object or `undefined` when array is empty
	 */
	function arrayToJSON(array, toJSONOptions) {
		if (!(array && array.length)) return undefined
		var obj = {}
		for (var i = 0; i < array.length; ++i) obj[array[i].name] = array[i].toJSON(toJSONOptions)
		return obj
	}
	Namespace.arrayToJSON = arrayToJSON

	/**
	 * Tests if the specified id is reserved.
	 * @param {Array.<number[]|string>|undefined} reserved Array of reserved ranges and names
	 * @param {number} id Id to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Namespace.isReservedId = function isReservedId(reserved, id) {
		if (reserved)
			for (var i = 0; i < reserved.length; ++i)
				if (typeof reserved[i] !== 'string' && reserved[i][0] <= id && reserved[i][1] > id) return true
		return false
	}

	/**
	 * Tests if the specified name is reserved.
	 * @param {Array.<number[]|string>|undefined} reserved Array of reserved ranges and names
	 * @param {string} name Name to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Namespace.isReservedName = function isReservedName(reserved, name) {
		if (reserved) for (var i = 0; i < reserved.length; ++i) if (reserved[i] === name) return true
		return false
	}

	/**
	 * Not an actual constructor. Use {@link Namespace} instead.
	 * @classdesc Base class of all reflection objects containing nested objects. This is not an actual class but here for the sake of having consistent type definitions.
	 * @exports NamespaceBase
	 * @extends ReflectionObject
	 * @abstract
	 * @constructor
	 * @param {string} name Namespace name
	 * @param {Object.<string,*>} [options] Declared options
	 * @see {@link Namespace}
	 */
	function Namespace(name, options) {
		ReflectionObject.call(this, name, options)

		/**
		 * Nested objects by name.
		 * @type {Object.<string,ReflectionObject>|undefined}
		 */
		this.nested = undefined // toJSON

		/**
		 * Cached nested objects as an array.
		 * @type {ReflectionObject[]|null}
		 * @private
		 */
		this._nestedArray = null
	}
	function clearCache(namespace) {
		namespace._nestedArray = null
		return namespace
	}

	/**
	 * Nested objects of this namespace as an array for iteration.
	 * @name NamespaceBase#nestedArray
	 * @type {ReflectionObject[]}
	 * @readonly
	 */
	Object.defineProperty(Namespace.prototype, 'nestedArray', {
		get: function () {
			return this._nestedArray || (this._nestedArray = util.toArray(this.nested))
		},
	})

	/**
	 * Namespace descriptor.
	 * @interface INamespace
	 * @property {Object.<string,*>} [options] Namespace options
	 * @property {Object.<string,AnyNestedObject>} [nested] Nested object descriptors
	 */

	/**
	 * Any extension field descriptor.
	 * @typedef AnyExtensionField
	 * @type {IExtensionField|IExtensionMapField}
	 */

	/**
	 * Any nested object descriptor.
	 * @typedef AnyNestedObject
	 * @type {IEnum|IType|IService|AnyExtensionField|INamespace|IOneOf}
	 */

	/**
	 * Converts this namespace to a namespace descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {INamespace} Namespace descriptor
	 */
	Namespace.prototype.toJSON = function toJSON(toJSONOptions) {
		return util.toObject(['options', this.options, 'nested', arrayToJSON(this.nestedArray, toJSONOptions)])
	}

	/**
	 * Adds nested objects to this namespace from nested object descriptors.
	 * @param {Object.<string,AnyNestedObject>} nestedJson Any nested object descriptors
	 * @returns {Namespace} `this`
	 */
	Namespace.prototype.addJSON = function addJSON(nestedJson) {
		var ns = this
		/* istanbul ignore else */
		if (nestedJson) {
			for (var names = Object.keys(nestedJson), i = 0, nested; i < names.length; ++i) {
				nested = nestedJson[names[i]]
				ns.add(
					// most to least likely
					(nested.fields !== undefined
						? Type.fromJSON
						: nested.values !== undefined
							? Enum.fromJSON
							: nested.methods !== undefined
								? Service.fromJSON
								: nested.id !== undefined
									? Field.fromJSON
									: Namespace.fromJSON)(names[i], nested),
				)
			}
		}
		return this
	}

	/**
	 * Gets the nested object of the specified name.
	 * @param {string} name Nested object name
	 * @returns {ReflectionObject|null} The reflection object or `null` if it doesn't exist
	 */
	Namespace.prototype.get = function get(name) {
		return (this.nested && this.nested[name]) || null
	}

	/**
	 * Gets the values of the nested {@link Enum|enum} of the specified name.
	 * This methods differs from {@link Namespace#get|get} in that it returns an enum's values directly and throws instead of returning `null`.
	 * @param {string} name Nested enum name
	 * @returns {Object.<string,number>} Enum values
	 * @throws {Error} If there is no such enum
	 */
	Namespace.prototype.getEnum = function getEnum(name) {
		if (this.nested && this.nested[name] instanceof Enum) return this.nested[name].values
		throw Error('no such enum: ' + name)
	}

	/**
	 * Adds a nested object to this namespace.
	 * @param {ReflectionObject} object Nested object to add
	 * @returns {Namespace} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If there is already a nested object with this name
	 */
	Namespace.prototype.add = function add(object) {
		if (
			!(
				(object instanceof Field && object.extend !== undefined) ||
				object instanceof Type ||
				object instanceof OneOf ||
				object instanceof Enum ||
				object instanceof Service ||
				object instanceof Namespace
			)
		)
			throw TypeError('object must be a valid nested object')
		if (!this.nested) this.nested = {}
		else {
			var prev = this.get(object.name)
			if (prev) {
				if (
					prev instanceof Namespace &&
					object instanceof Namespace &&
					!(prev instanceof Type || prev instanceof Service)
				) {
					// replace plain namespace but keep existing nested elements and options
					var nested = prev.nestedArray
					for (var i = 0; i < nested.length; ++i) object.add(nested[i])
					this.remove(prev)
					if (!this.nested) this.nested = {}
					object.setOptions(prev.options, true)
				} else throw Error("duplicate name '" + object.name + "' in " + this)
			}
		}
		this.nested[object.name] = object
		object.onAdd(this)
		return clearCache(this)
	}

	/**
	 * Removes a nested object from this namespace.
	 * @param {ReflectionObject} object Nested object to remove
	 * @returns {Namespace} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If `object` is not a member of this namespace
	 */
	Namespace.prototype.remove = function remove(object) {
		if (!(object instanceof ReflectionObject)) throw TypeError('object must be a ReflectionObject')
		if (object.parent !== this) throw Error(object + ' is not a member of ' + this)
		delete this.nested[object.name]
		if (!Object.keys(this.nested).length) this.nested = undefined
		object.onRemove(this)
		return clearCache(this)
	}

	/**
	 * Defines additial namespaces within this one if not yet existing.
	 * @param {string|string[]} path Path to create
	 * @param {*} [json] Nested types to create from JSON
	 * @returns {Namespace} Pointer to the last namespace created or `this` if path is empty
	 */
	Namespace.prototype.define = function define(path, json) {
		if (util.isString(path)) path = path.split('.')
		else if (!Array.isArray(path)) throw TypeError('illegal path')
		if (path && path.length && path[0] === '') throw Error('path must be relative')
		var ptr = this
		while (path.length > 0) {
			var part = path.shift()
			if (ptr.nested && ptr.nested[part]) {
				ptr = ptr.nested[part]
				if (!(ptr instanceof Namespace)) throw Error('path conflicts with non-namespace objects')
			} else ptr.add((ptr = new Namespace(part)))
		}
		if (json) ptr.addJSON(json)
		return ptr
	}

	/**
	 * Resolves this namespace's and all its nested objects' type references. Useful to validate a reflection tree, but comes at a cost.
	 * @returns {Namespace} `this`
	 */
	Namespace.prototype.resolveAll = function resolveAll() {
		var nested = this.nestedArray,
			i = 0
		while (i < nested.length)
			if (nested[i] instanceof Namespace) nested[i++].resolveAll()
			else nested[i++].resolve()
		return this.resolve()
	}

	/**
	 * Recursively looks up the reflection object matching the specified path in the scope of this namespace.
	 * @param {string|string[]} path Path to look up
	 * @param {*|Array.<*>} filterTypes Filter types, any combination of the constructors of `protobuf.Type`, `protobuf.Enum`, `protobuf.Service` etc.
	 * @param {boolean} [parentAlreadyChecked=false] If known, whether the parent has already been checked
	 * @returns {ReflectionObject|null} Looked up object or `null` if none could be found
	 */
	Namespace.prototype.lookup = function lookup(path, filterTypes, parentAlreadyChecked) {
		/* istanbul ignore next */
		if (typeof filterTypes === 'boolean') {
			parentAlreadyChecked = filterTypes
			filterTypes = undefined
		} else if (filterTypes && !Array.isArray(filterTypes)) filterTypes = [filterTypes]
		if (util.isString(path) && path.length) {
			if (path === '.') return this.root
			path = path.split('.')
		} else if (!path.length) return this

		// Start at root if path is absolute
		if (path[0] === '') return this.root.lookup(path.slice(1), filterTypes)

		// Test if the first part matches any nested object, and if so, traverse if path contains more
		var found = this.get(path[0])
		if (found) {
			if (path.length === 1) {
				if (!filterTypes || filterTypes.indexOf(found.constructor) > -1) return found
			} else if (found instanceof Namespace && (found = found.lookup(path.slice(1), filterTypes, true))) return found

			// Otherwise try each nested namespace
		} else
			for (var i = 0; i < this.nestedArray.length; ++i)
				if (this._nestedArray[i] instanceof Namespace && (found = this._nestedArray[i].lookup(path, filterTypes, true)))
					return found

		// If there hasn't been a match, try again at the parent
		if (this.parent === null || parentAlreadyChecked) return null
		return this.parent.lookup(path, filterTypes)
	}

	/**
	 * Looks up the reflection object at the specified path, relative to this namespace.
	 * @name NamespaceBase#lookup
	 * @function
	 * @param {string|string[]} path Path to look up
	 * @param {boolean} [parentAlreadyChecked=false] Whether the parent has already been checked
	 * @returns {ReflectionObject|null} Looked up object or `null` if none could be found
	 * @variation 2
	 */
	// lookup(path: string, [parentAlreadyChecked: boolean])

	/**
	 * Looks up the {@link Type|type} at the specified path, relative to this namespace.
	 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
	 * @param {string|string[]} path Path to look up
	 * @returns {Type} Looked up type
	 * @throws {Error} If `path` does not point to a type
	 */
	Namespace.prototype.lookupType = function lookupType(path) {
		var found = this.lookup(path, [Type])
		if (!found) throw Error('no such type: ' + path)
		return found
	}

	/**
	 * Looks up the values of the {@link Enum|enum} at the specified path, relative to this namespace.
	 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
	 * @param {string|string[]} path Path to look up
	 * @returns {Enum} Looked up enum
	 * @throws {Error} If `path` does not point to an enum
	 */
	Namespace.prototype.lookupEnum = function lookupEnum(path) {
		var found = this.lookup(path, [Enum])
		if (!found) throw Error("no such Enum '" + path + "' in " + this)
		return found
	}

	/**
	 * Looks up the {@link Type|type} or {@link Enum|enum} at the specified path, relative to this namespace.
	 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
	 * @param {string|string[]} path Path to look up
	 * @returns {Type} Looked up type or enum
	 * @throws {Error} If `path` does not point to a type or enum
	 */
	Namespace.prototype.lookupTypeOrEnum = function lookupTypeOrEnum(path) {
		var found = this.lookup(path, [Type, Enum])
		if (!found) throw Error("no such Type or Enum '" + path + "' in " + this)
		return found
	}

	/**
	 * Looks up the {@link Service|service} at the specified path, relative to this namespace.
	 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
	 * @param {string|string[]} path Path to look up
	 * @returns {Service} Looked up service
	 * @throws {Error} If `path` does not point to a service
	 */
	Namespace.prototype.lookupService = function lookupService(path) {
		var found = this.lookup(path, [Service])
		if (!found) throw Error("no such Service '" + path + "' in " + this)
		return found
	}

	// Sets up cyclic dependencies (called in index-light)
	Namespace._configure = function (Type_, Service_, Enum_) {
		Type = Type_
		Service = Service_
		Enum = Enum_
	}
	return namespace
}

var mapfield
var hasRequiredMapfield
function requireMapfield() {
	if (hasRequiredMapfield) return mapfield
	hasRequiredMapfield = 1
	mapfield = MapField

	// extends Field
	var Field = requireField()
	;((MapField.prototype = Object.create(Field.prototype)).constructor = MapField).className = 'MapField'
	var types = requireTypes(),
		util = requireUtil()

	/**
	 * Constructs a new map field instance.
	 * @classdesc Reflected map field.
	 * @extends FieldBase
	 * @constructor
	 * @param {string} name Unique name within its namespace
	 * @param {number} id Unique id within its namespace
	 * @param {string} keyType Key type
	 * @param {string} type Value type
	 * @param {Object.<string,*>} [options] Declared options
	 * @param {string} [comment] Comment associated with this field
	 */
	function MapField(name, id, keyType, type, options, comment) {
		Field.call(this, name, id, type, undefined, undefined, options, comment)

		/* istanbul ignore if */
		if (!util.isString(keyType)) throw TypeError('keyType must be a string')

		/**
		 * Key type.
		 * @type {string}
		 */
		this.keyType = keyType // toJSON, marker

		/**
		 * Resolved key type if not a basic type.
		 * @type {ReflectionObject|null}
		 */
		this.resolvedKeyType = null

		// Overrides Field#map
		this.map = true
	}

	/**
	 * Map field descriptor.
	 * @interface IMapField
	 * @extends {IField}
	 * @property {string} keyType Key type
	 */

	/**
	 * Extension map field descriptor.
	 * @interface IExtensionMapField
	 * @extends IMapField
	 * @property {string} extend Extended type
	 */

	/**
	 * Constructs a map field from a map field descriptor.
	 * @param {string} name Field name
	 * @param {IMapField} json Map field descriptor
	 * @returns {MapField} Created map field
	 * @throws {TypeError} If arguments are invalid
	 */
	MapField.fromJSON = function fromJSON(name, json) {
		return new MapField(name, json.id, json.keyType, json.type, json.options, json.comment)
	}

	/**
	 * Converts this map field to a map field descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IMapField} Map field descriptor
	 */
	MapField.prototype.toJSON = function toJSON(toJSONOptions) {
		var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false
		return util.toObject([
			'keyType',
			this.keyType,
			'type',
			this.type,
			'id',
			this.id,
			'extend',
			this.extend,
			'options',
			this.options,
			'comment',
			keepComments ? this.comment : undefined,
		])
	}

	/**
	 * @override
	 */
	MapField.prototype.resolve = function resolve() {
		if (this.resolved) return this

		// Besides a value type, map fields have a key type that may be "any scalar type except for floating point types and bytes"
		if (types.mapKey[this.keyType] === undefined) throw Error('invalid key type: ' + this.keyType)
		return Field.prototype.resolve.call(this)
	}

	/**
	 * Map field decorator (TypeScript).
	 * @name MapField.d
	 * @function
	 * @param {number} fieldId Field id
	 * @param {"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"bool"|"string"} fieldKeyType Field key type
	 * @param {"double"|"float"|"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"bool"|"string"|"bytes"|Object|Constructor<{}>} fieldValueType Field value type
	 * @returns {FieldDecorator} Decorator function
	 * @template T extends { [key: string]: number | Long | string | boolean | Uint8Array | Buffer | number[] | Message<{}> }
	 */
	MapField.d = function decorateMapField(fieldId, fieldKeyType, fieldValueType) {
		// submessage value: decorate the submessage and use its name as the type
		if (typeof fieldValueType === 'function') fieldValueType = util.decorateType(fieldValueType).name
		// enum reference value: create a reflected copy of the enum and keep reuseing it
		else if (fieldValueType && typeof fieldValueType === 'object')
			fieldValueType = util.decorateEnum(fieldValueType).name
		return function mapFieldDecorator(prototype, fieldName) {
			util.decorateType(prototype.constructor).add(new MapField(fieldName, fieldId, fieldKeyType, fieldValueType))
		}
	}
	return mapfield
}

var method
var hasRequiredMethod
function requireMethod() {
	if (hasRequiredMethod) return method
	hasRequiredMethod = 1
	method = Method

	// extends ReflectionObject
	var ReflectionObject = requireObject()
	;((Method.prototype = Object.create(ReflectionObject.prototype)).constructor = Method).className = 'Method'
	var util = requireUtil()

	/**
	 * Constructs a new service method instance.
	 * @classdesc Reflected service method.
	 * @extends ReflectionObject
	 * @constructor
	 * @param {string} name Method name
	 * @param {string|undefined} type Method type, usually `"rpc"`
	 * @param {string} requestType Request message type
	 * @param {string} responseType Response message type
	 * @param {boolean|Object.<string,*>} [requestStream] Whether the request is streamed
	 * @param {boolean|Object.<string,*>} [responseStream] Whether the response is streamed
	 * @param {Object.<string,*>} [options] Declared options
	 * @param {string} [comment] The comment for this method
	 * @param {Object.<string,*>} [parsedOptions] Declared options, properly parsed into an object
	 */
	function Method(
		name,
		type,
		requestType,
		responseType,
		requestStream,
		responseStream,
		options,
		comment,
		parsedOptions,
	) {
		/* istanbul ignore next */
		if (util.isObject(requestStream)) {
			options = requestStream
			requestStream = responseStream = undefined
		} else if (util.isObject(responseStream)) {
			options = responseStream
			responseStream = undefined
		}

		/* istanbul ignore if */
		if (!(type === undefined || util.isString(type))) throw TypeError('type must be a string')

		/* istanbul ignore if */
		if (!util.isString(requestType)) throw TypeError('requestType must be a string')

		/* istanbul ignore if */
		if (!util.isString(responseType)) throw TypeError('responseType must be a string')
		ReflectionObject.call(this, name, options)

		/**
		 * Method type.
		 * @type {string}
		 */
		this.type = type || 'rpc' // toJSON

		/**
		 * Request type.
		 * @type {string}
		 */
		this.requestType = requestType // toJSON, marker

		/**
		 * Whether requests are streamed or not.
		 * @type {boolean|undefined}
		 */
		this.requestStream = requestStream ? true : undefined // toJSON

		/**
		 * Response type.
		 * @type {string}
		 */
		this.responseType = responseType // toJSON

		/**
		 * Whether responses are streamed or not.
		 * @type {boolean|undefined}
		 */
		this.responseStream = responseStream ? true : undefined // toJSON

		/**
		 * Resolved request type.
		 * @type {Type|null}
		 */
		this.resolvedRequestType = null

		/**
		 * Resolved response type.
		 * @type {Type|null}
		 */
		this.resolvedResponseType = null

		/**
		 * Comment for this method
		 * @type {string|null}
		 */
		this.comment = comment

		/**
		 * Options properly parsed into an object
		 */
		this.parsedOptions = parsedOptions
	}

	/**
	 * Method descriptor.
	 * @interface IMethod
	 * @property {string} [type="rpc"] Method type
	 * @property {string} requestType Request type
	 * @property {string} responseType Response type
	 * @property {boolean} [requestStream=false] Whether requests are streamed
	 * @property {boolean} [responseStream=false] Whether responses are streamed
	 * @property {Object.<string,*>} [options] Method options
	 * @property {string} comment Method comments
	 * @property {Object.<string,*>} [parsedOptions] Method options properly parsed into an object
	 */

	/**
	 * Constructs a method from a method descriptor.
	 * @param {string} name Method name
	 * @param {IMethod} json Method descriptor
	 * @returns {Method} Created method
	 * @throws {TypeError} If arguments are invalid
	 */
	Method.fromJSON = function fromJSON(name, json) {
		return new Method(
			name,
			json.type,
			json.requestType,
			json.responseType,
			json.requestStream,
			json.responseStream,
			json.options,
			json.comment,
			json.parsedOptions,
		)
	}

	/**
	 * Converts this method to a method descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IMethod} Method descriptor
	 */
	Method.prototype.toJSON = function toJSON(toJSONOptions) {
		var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false
		return util.toObject([
			'type',
			(this.type !== 'rpc' && /* istanbul ignore next */ this.type) || undefined,
			'requestType',
			this.requestType,
			'requestStream',
			this.requestStream,
			'responseType',
			this.responseType,
			'responseStream',
			this.responseStream,
			'options',
			this.options,
			'comment',
			keepComments ? this.comment : undefined,
			'parsedOptions',
			this.parsedOptions,
		])
	}

	/**
	 * @override
	 */
	Method.prototype.resolve = function resolve() {
		/* istanbul ignore if */
		if (this.resolved) return this
		this.resolvedRequestType = this.parent.lookupType(this.requestType)
		this.resolvedResponseType = this.parent.lookupType(this.responseType)
		return ReflectionObject.prototype.resolve.call(this)
	}
	return method
}

var service
var hasRequiredService
function requireService() {
	if (hasRequiredService) return service
	hasRequiredService = 1
	service = Service

	// extends Namespace
	var Namespace = requireNamespace()
	;((Service.prototype = Object.create(Namespace.prototype)).constructor = Service).className = 'Service'
	var Method = requireMethod(),
		util = requireUtil(),
		rpc$1 = rpc

	/**
	 * Constructs a new service instance.
	 * @classdesc Reflected service.
	 * @extends NamespaceBase
	 * @constructor
	 * @param {string} name Service name
	 * @param {Object.<string,*>} [options] Service options
	 * @throws {TypeError} If arguments are invalid
	 */
	function Service(name, options) {
		Namespace.call(this, name, options)

		/**
		 * Service methods.
		 * @type {Object.<string,Method>}
		 */
		this.methods = {} // toJSON, marker

		/**
		 * Cached methods as an array.
		 * @type {Method[]|null}
		 * @private
		 */
		this._methodsArray = null
	}

	/**
	 * Service descriptor.
	 * @interface IService
	 * @extends INamespace
	 * @property {Object.<string,IMethod>} methods Method descriptors
	 */

	/**
	 * Constructs a service from a service descriptor.
	 * @param {string} name Service name
	 * @param {IService} json Service descriptor
	 * @returns {Service} Created service
	 * @throws {TypeError} If arguments are invalid
	 */
	Service.fromJSON = function fromJSON(name, json) {
		var service = new Service(name, json.options)
		/* istanbul ignore else */
		if (json.methods)
			for (var names = Object.keys(json.methods), i = 0; i < names.length; ++i)
				service.add(Method.fromJSON(names[i], json.methods[names[i]]))
		if (json.nested) service.addJSON(json.nested)
		service.comment = json.comment
		return service
	}

	/**
	 * Converts this service to a service descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IService} Service descriptor
	 */
	Service.prototype.toJSON = function toJSON(toJSONOptions) {
		var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions)
		var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false
		return util.toObject([
			'options',
			(inherited && inherited.options) || undefined,
			'methods',
			Namespace.arrayToJSON(this.methodsArray, toJSONOptions) || /* istanbul ignore next */ {},
			'nested',
			(inherited && inherited.nested) || undefined,
			'comment',
			keepComments ? this.comment : undefined,
		])
	}

	/**
	 * Methods of this service as an array for iteration.
	 * @name Service#methodsArray
	 * @type {Method[]}
	 * @readonly
	 */
	Object.defineProperty(Service.prototype, 'methodsArray', {
		get: function () {
			return this._methodsArray || (this._methodsArray = util.toArray(this.methods))
		},
	})
	function clearCache(service) {
		service._methodsArray = null
		return service
	}

	/**
	 * @override
	 */
	Service.prototype.get = function get(name) {
		return this.methods[name] || Namespace.prototype.get.call(this, name)
	}

	/**
	 * @override
	 */
	Service.prototype.resolveAll = function resolveAll() {
		var methods = this.methodsArray
		for (var i = 0; i < methods.length; ++i) methods[i].resolve()
		return Namespace.prototype.resolve.call(this)
	}

	/**
	 * @override
	 */
	Service.prototype.add = function add(object) {
		/* istanbul ignore if */
		if (this.get(object.name)) throw Error("duplicate name '" + object.name + "' in " + this)
		if (object instanceof Method) {
			this.methods[object.name] = object
			object.parent = this
			return clearCache(this)
		}
		return Namespace.prototype.add.call(this, object)
	}

	/**
	 * @override
	 */
	Service.prototype.remove = function remove(object) {
		if (object instanceof Method) {
			/* istanbul ignore if */
			if (this.methods[object.name] !== object) throw Error(object + ' is not a member of ' + this)
			delete this.methods[object.name]
			object.parent = null
			return clearCache(this)
		}
		return Namespace.prototype.remove.call(this, object)
	}

	/**
	 * Creates a runtime service using the specified rpc implementation.
	 * @param {RPCImpl} rpcImpl RPC implementation
	 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
	 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
	 * @returns {rpc.Service} RPC service. Useful where requests and/or responses are streamed.
	 */
	Service.prototype.create = function create(rpcImpl, requestDelimited, responseDelimited) {
		var rpcService = new rpc$1.Service(rpcImpl, requestDelimited, responseDelimited)
		for (var i = 0, method; i < /* initializes */ this.methodsArray.length; ++i) {
			var methodName = util.lcFirst((method = this._methodsArray[i]).resolve().name).replace(/[^$\w_]/g, '')
			rpcService[methodName] = util.codegen(
				['r', 'c'],
				util.isReserved(methodName) ? methodName + '_' : methodName,
			)('return this.rpcCall(m,q,s,r,c)')({
				m: method,
				q: method.resolvedRequestType.ctor,
				s: method.resolvedResponseType.ctor,
			})
		}
		return rpcService
	}
	return service
}

var message = Message
var util$1 = requireMinimal()

/**
 * Constructs a new message instance.
 * @classdesc Abstract runtime message.
 * @constructor
 * @param {Properties<T>} [properties] Properties to set
 * @template T extends object = object
 */
function Message(properties) {
	// not used internally
	if (properties)
		for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i) this[keys[i]] = properties[keys[i]]
}

/**
 * Reference to the reflected type.
 * @name Message.$type
 * @type {Type}
 * @readonly
 */

/**
 * Reference to the reflected type.
 * @name Message#$type
 * @type {Type}
 * @readonly
 */

/*eslint-disable valid-jsdoc*/

/**
 * Creates a new message of this type using the specified properties.
 * @param {Object.<string,*>} [properties] Properties to set
 * @returns {Message<T>} Message instance
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.create = function create(properties) {
	return this.$type.create(properties)
}

/**
 * Encodes a message of this type.
 * @param {T|Object.<string,*>} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.encode = function encode(message, writer) {
	return this.$type.encode(message, writer)
}

/**
 * Encodes a message of this type preceeded by its length as a varint.
 * @param {T|Object.<string,*>} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.encodeDelimited = function encodeDelimited(message, writer) {
	return this.$type.encodeDelimited(message, writer)
}

/**
 * Decodes a message of this type.
 * @name Message.decode
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {T} Decoded message
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.decode = function decode(reader) {
	return this.$type.decode(reader)
}

/**
 * Decodes a message of this type preceeded by its length as a varint.
 * @name Message.decodeDelimited
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {T} Decoded message
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.decodeDelimited = function decodeDelimited(reader) {
	return this.$type.decodeDelimited(reader)
}

/**
 * Verifies a message of this type.
 * @name Message.verify
 * @function
 * @param {Object.<string,*>} message Plain object to verify
 * @returns {string|null} `null` if valid, otherwise the reason why it is not
 */
Message.verify = function verify(message) {
	return this.$type.verify(message)
}

/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * @param {Object.<string,*>} object Plain object
 * @returns {T} Message instance
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.fromObject = function fromObject(object) {
	return this.$type.fromObject(object)
}

/**
 * Creates a plain object from a message of this type. Also converts values to other types if specified.
 * @param {T} message Message instance
 * @param {IConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.toObject = function toObject(message, options) {
	return this.$type.toObject(message, options)
}

/**
 * Converts this message to JSON.
 * @returns {Object.<string,*>} JSON object
 */
Message.prototype.toJSON = function toJSON() {
	return this.$type.toObject(this, util$1.toJSONOptions)
}

var decoder_1
var hasRequiredDecoder
function requireDecoder() {
	if (hasRequiredDecoder) return decoder_1
	hasRequiredDecoder = 1
	decoder_1 = decoder
	var Enum = require_enum(),
		types = requireTypes(),
		util = requireUtil()
	function missing(field) {
		return "missing required '" + field.name + "'"
	}

	/**
	 * Generates a decoder specific to the specified message type.
	 * @param {Type} mtype Message type
	 * @returns {Codegen} Codegen instance
	 */
	function decoder(mtype) {
		/* eslint-disable no-unexpected-multiline */
		var gen = util.codegen(['r', 'l'], mtype.name + '$decode')('if(!(r instanceof Reader))')('r=Reader.create(r)')(
			'var c=l===undefined?r.len:r.pos+l,m=new this.ctor' +
				(mtype.fieldsArray.filter(function (field) {
					return field.map
				}).length
					? ',k,value'
					: ''),
		)('while(r.pos<c){')('var t=r.uint32()')
		if (mtype.group) gen('if((t&7)===4)')('break')
		gen('switch(t>>>3){')
		var i = 0
		for (; i < /* initializes */ mtype.fieldsArray.length; ++i) {
			var field = mtype._fieldsArray[i].resolve(),
				type = field.resolvedType instanceof Enum ? 'int32' : field.type,
				ref = 'm' + util.safeProp(field.name)
			gen('case %i: {', field.id)

			// Map fields
			if (field.map) {
				gen('if(%s===util.emptyObject)', ref)('%s={}', ref)('var c2 = r.uint32()+r.pos')
				if (types.defaults[field.keyType] !== undefined) gen('k=%j', types.defaults[field.keyType])
				else gen('k=null')
				if (types.defaults[type] !== undefined) gen('value=%j', types.defaults[type])
				else gen('value=null')
				gen('while(r.pos<c2){')('var tag2=r.uint32()')('switch(tag2>>>3){')('case 1: k=r.%s(); break', field.keyType)(
					'case 2:',
				)
				if (types.basic[type] === undefined)
					gen('value=types[%i].decode(r,r.uint32())', i) // can't be groups
				else gen('value=r.%s()', type)
				gen('break')('default:')('r.skipType(tag2&7)')('break')('}')('}')
				if (types.long[field.keyType] !== undefined) gen('%s[typeof k==="object"?util.longToHash(k):k]=value', ref)
				else gen('%s[k]=value', ref)

				// Repeated fields
			} else if (field.repeated) {
				gen('if(!(%s&&%s.length))', ref, ref)('%s=[]', ref)

				// Packable (always check for forward and backward compatiblity)
				if (types.packed[type] !== undefined)
					gen('if((t&7)===2){')('var c2=r.uint32()+r.pos')('while(r.pos<c2)')('%s.push(r.%s())', ref, type)('}else')

				// Non-packed
				if (types.basic[type] === undefined)
					gen(
						field.resolvedType.group ? '%s.push(types[%i].decode(r))' : '%s.push(types[%i].decode(r,r.uint32()))',
						ref,
						i,
					)
				else gen('%s.push(r.%s())', ref, type)

				// Non-repeated
			} else if (types.basic[type] === undefined)
				gen(field.resolvedType.group ? '%s=types[%i].decode(r)' : '%s=types[%i].decode(r,r.uint32())', ref, i)
			else gen('%s=r.%s()', ref, type)
			gen('break')('}')
			// Unknown fields
		}
		gen('default:')('r.skipType(t&7)')('break')('}')('}')

		// Field presence
		for (i = 0; i < mtype._fieldsArray.length; ++i) {
			var rfield = mtype._fieldsArray[i]
			if (rfield.required)
				gen('if(!m.hasOwnProperty(%j))', rfield.name)('throw util.ProtocolError(%j,{instance:m})', missing(rfield))
		}
		return gen('return m')
		/* eslint-enable no-unexpected-multiline */
	}
	return decoder_1
}

var verifier_1
var hasRequiredVerifier
function requireVerifier() {
	if (hasRequiredVerifier) return verifier_1
	hasRequiredVerifier = 1
	verifier_1 = verifier
	var Enum = require_enum(),
		util = requireUtil()
	function invalid(field, expected) {
		return (
			field.name +
			': ' +
			expected +
			(field.repeated && expected !== 'array'
				? '[]'
				: field.map && expected !== 'object'
					? '{k:' + field.keyType + '}'
					: '') +
			' expected'
		)
	}

	/**
	 * Generates a partial value verifier.
	 * @param {Codegen} gen Codegen instance
	 * @param {Field} field Reflected field
	 * @param {number} fieldIndex Field index
	 * @param {string} ref Variable reference
	 * @returns {Codegen} Codegen instance
	 * @ignore
	 */
	function genVerifyValue(gen, field, fieldIndex, ref) {
		/* eslint-disable no-unexpected-multiline */
		if (field.resolvedType) {
			if (field.resolvedType instanceof Enum) {
				gen('switch(%s){', ref)('default:')('return%j', invalid(field, 'enum value'))
				for (var keys = Object.keys(field.resolvedType.values), j = 0; j < keys.length; ++j)
					gen('case %i:', field.resolvedType.values[keys[j]])
				gen('break')('}')
			} else {
				gen('{')('var e=types[%i].verify(%s);', fieldIndex, ref)('if(e)')('return%j+e', field.name + '.')('}')
			}
		} else {
			switch (field.type) {
				case 'int32':
				case 'uint32':
				case 'sint32':
				case 'fixed32':
				case 'sfixed32':
					gen('if(!util.isInteger(%s))', ref)('return%j', invalid(field, 'integer'))
					break
				case 'int64':
				case 'uint64':
				case 'sint64':
				case 'fixed64':
				case 'sfixed64':
					gen(
						'if(!util.isInteger(%s)&&!(%s&&util.isInteger(%s.low)&&util.isInteger(%s.high)))',
						ref,
						ref,
						ref,
						ref,
					)('return%j', invalid(field, 'integer|Long'))
					break
				case 'float':
				case 'double':
					gen('if(typeof %s!=="number")', ref)('return%j', invalid(field, 'number'))
					break
				case 'bool':
					gen('if(typeof %s!=="boolean")', ref)('return%j', invalid(field, 'boolean'))
					break
				case 'string':
					gen('if(!util.isString(%s))', ref)('return%j', invalid(field, 'string'))
					break
				case 'bytes':
					gen(
						'if(!(%s&&typeof %s.length==="number"||util.isString(%s)))',
						ref,
						ref,
						ref,
					)('return%j', invalid(field, 'buffer'))
					break
			}
		}
		return gen
		/* eslint-enable no-unexpected-multiline */
	}

	/**
	 * Generates a partial key verifier.
	 * @param {Codegen} gen Codegen instance
	 * @param {Field} field Reflected field
	 * @param {string} ref Variable reference
	 * @returns {Codegen} Codegen instance
	 * @ignore
	 */
	function genVerifyKey(gen, field, ref) {
		/* eslint-disable no-unexpected-multiline */
		switch (field.keyType) {
			case 'int32':
			case 'uint32':
			case 'sint32':
			case 'fixed32':
			case 'sfixed32':
				gen('if(!util.key32Re.test(%s))', ref)('return%j', invalid(field, 'integer key'))
				break
			case 'int64':
			case 'uint64':
			case 'sint64':
			case 'fixed64':
			case 'sfixed64':
				gen('if(!util.key64Re.test(%s))', ref)(
					// see comment above: x is ok, d is not
					'return%j',
					invalid(field, 'integer|Long key'),
				)
				break
			case 'bool':
				gen('if(!util.key2Re.test(%s))', ref)('return%j', invalid(field, 'boolean key'))
				break
		}
		return gen
		/* eslint-enable no-unexpected-multiline */
	}

	/**
	 * Generates a verifier specific to the specified message type.
	 * @param {Type} mtype Message type
	 * @returns {Codegen} Codegen instance
	 */
	function verifier(mtype) {
		/* eslint-disable no-unexpected-multiline */

		var gen = util.codegen(['m'], mtype.name + '$verify')('if(typeof m!=="object"||m===null)')(
			'return%j',
			'object expected',
		)
		var oneofs = mtype.oneofsArray,
			seenFirstField = {}
		if (oneofs.length) gen('var p={}')
		for (var i = 0; i < /* initializes */ mtype.fieldsArray.length; ++i) {
			var field = mtype._fieldsArray[i].resolve(),
				ref = 'm' + util.safeProp(field.name)
			if (field.optional) gen('if(%s!=null&&m.hasOwnProperty(%j)){', ref, field.name) // !== undefined && !== null

			// map fields
			if (field.map) {
				gen('if(!util.isObject(%s))', ref)('return%j', invalid(field, 'object'))('var k=Object.keys(%s)', ref)(
					'for(var i=0;i<k.length;++i){',
				)
				genVerifyKey(gen, field, 'k[i]')
				genVerifyValue(gen, field, i, ref + '[k[i]]')('}')

				// repeated fields
			} else if (field.repeated) {
				gen('if(!Array.isArray(%s))', ref)('return%j', invalid(field, 'array'))('for(var i=0;i<%s.length;++i){', ref)
				genVerifyValue(gen, field, i, ref + '[i]')('}')

				// required or present fields
			} else {
				if (field.partOf) {
					var oneofProp = util.safeProp(field.partOf.name)
					if (seenFirstField[field.partOf.name] === 1)
						gen('if(p%s===1)', oneofProp)('return%j', field.partOf.name + ': multiple values')
					seenFirstField[field.partOf.name] = 1
					gen('p%s=1', oneofProp)
				}
				genVerifyValue(gen, field, i, ref)
			}
			if (field.optional) gen('}')
		}
		return gen('return null')
		/* eslint-enable no-unexpected-multiline */
	}
	return verifier_1
}

var converter = {}

var hasRequiredConverter
function requireConverter() {
	if (hasRequiredConverter) return converter
	hasRequiredConverter = 1
	;(function (exports) {
		/**
		 * Runtime message from/to plain object converters.
		 * @namespace
		 */
		var converter = exports
		var Enum = require_enum(),
			util = requireUtil()

		/**
		 * Generates a partial value fromObject conveter.
		 * @param {Codegen} gen Codegen instance
		 * @param {Field} field Reflected field
		 * @param {number} fieldIndex Field index
		 * @param {string} prop Property reference
		 * @returns {Codegen} Codegen instance
		 * @ignore
		 */
		function genValuePartial_fromObject(gen, field, fieldIndex, prop) {
			var defaultAlreadyEmitted = false
			/* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
			if (field.resolvedType) {
				if (field.resolvedType instanceof Enum) {
					gen('switch(d%s){', prop)
					for (var values = field.resolvedType.values, keys = Object.keys(values), i = 0; i < keys.length; ++i) {
						// enum unknown values passthrough
						if (values[keys[i]] === field.typeDefault && !defaultAlreadyEmitted) {
							gen('default:')('if(typeof(d%s)==="number"){m%s=d%s;break}', prop, prop, prop)
							if (!field.repeated)
								gen(
									// fallback to default value only for
									// arrays, to avoid leaving holes.
									'break',
								) // for non-repeated fields, just ignore
							defaultAlreadyEmitted = true
						}
						gen('case%j:', keys[i])('case %i:', values[keys[i]])('m%s=%j', prop, values[keys[i]])('break')
					}
					gen('}')
				} else
					gen('if(typeof d%s!=="object")', prop)('throw TypeError(%j)', field.fullName + ': object expected')(
						'm%s=types[%i].fromObject(d%s)',
						prop,
						fieldIndex,
						prop,
					)
			} else {
				var isUnsigned = false
				switch (field.type) {
					case 'double':
					case 'float':
						gen('m%s=Number(d%s)', prop, prop) // also catches "NaN", "Infinity"
						break
					case 'uint32':
					case 'fixed32':
						gen('m%s=d%s>>>0', prop, prop)
						break
					case 'int32':
					case 'sint32':
					case 'sfixed32':
						gen('m%s=d%s|0', prop, prop)
						break
					case 'uint64':
						isUnsigned = true
					// eslint-disable-next-line no-fallthrough
					case 'int64':
					case 'sint64':
					case 'fixed64':
					case 'sfixed64':
						gen('if(util.Long)')('(m%s=util.Long.fromValue(d%s)).unsigned=%j', prop, prop, isUnsigned)(
							'else if(typeof d%s==="string")',
							prop,
						)(
							'm%s=parseInt(d%s,10)',
							prop,
							prop,
						)('else if(typeof d%s==="number")', prop)(
							'm%s=d%s',
							prop,
							prop,
						)('else if(typeof d%s==="object")', prop)(
							'm%s=new util.LongBits(d%s.low>>>0,d%s.high>>>0).toNumber(%s)',
							prop,
							prop,
							prop,
							isUnsigned ? 'true' : '',
						)
						break
					case 'bytes':
						gen('if(typeof d%s==="string")', prop)(
							'util.base64.decode(d%s,m%s=util.newBuffer(util.base64.length(d%s)),0)',
							prop,
							prop,
							prop,
						)('else if(d%s.length >= 0)', prop)('m%s=d%s', prop, prop)
						break
					case 'string':
						gen('m%s=String(d%s)', prop, prop)
						break
					case 'bool':
						gen('m%s=Boolean(d%s)', prop, prop)
						break
					/* default: gen
              ("m%s=d%s", prop, prop);
              break; */
				}
			}
			return gen
			/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
		}

		/**
		 * Generates a plain object to runtime message converter specific to the specified message type.
		 * @param {Type} mtype Message type
		 * @returns {Codegen} Codegen instance
		 */
		converter.fromObject = function fromObject(mtype) {
			/* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
			var fields = mtype.fieldsArray
			var gen = util.codegen(['d'], mtype.name + '$fromObject')('if(d instanceof this.ctor)')('return d')
			if (!fields.length) return gen('return new this.ctor')
			gen('var m=new this.ctor')
			for (var i = 0; i < fields.length; ++i) {
				var field = fields[i].resolve(),
					prop = util.safeProp(field.name)

				// Map fields
				if (field.map) {
					gen('if(d%s){', prop)('if(typeof d%s!=="object")', prop)(
						'throw TypeError(%j)',
						field.fullName + ': object expected',
					)('m%s={}', prop)('for(var ks=Object.keys(d%s),i=0;i<ks.length;++i){', prop)
					genValuePartial_fromObject(gen, field, /* not sorted */ i, prop + '[ks[i]]')('}')('}')

					// Repeated fields
				} else if (field.repeated) {
					gen('if(d%s){', prop)('if(!Array.isArray(d%s))', prop)(
						'throw TypeError(%j)',
						field.fullName + ': array expected',
					)('m%s=[]', prop)('for(var i=0;i<d%s.length;++i){', prop)
					genValuePartial_fromObject(gen, field, /* not sorted */ i, prop + '[i]')('}')('}')

					// Non-repeated fields
				} else {
					if (!(field.resolvedType instanceof Enum))
						gen(
							// no need to test for null/undefined if an enum (uses switch)
							'if(d%s!=null){',
							prop,
						) // !== undefined && !== null
					genValuePartial_fromObject(gen, field, /* not sorted */ i, prop)
					if (!(field.resolvedType instanceof Enum)) gen('}')
				}
			}
			return gen('return m')
			/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
		}

		/**
		 * Generates a partial value toObject converter.
		 * @param {Codegen} gen Codegen instance
		 * @param {Field} field Reflected field
		 * @param {number} fieldIndex Field index
		 * @param {string} prop Property reference
		 * @returns {Codegen} Codegen instance
		 * @ignore
		 */
		function genValuePartial_toObject(gen, field, fieldIndex, prop) {
			/* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
			if (field.resolvedType) {
				if (field.resolvedType instanceof Enum)
					gen(
						'd%s=o.enums===String?(types[%i].values[m%s]===undefined?m%s:types[%i].values[m%s]):m%s',
						prop,
						fieldIndex,
						prop,
						prop,
						fieldIndex,
						prop,
						prop,
					)
				else gen('d%s=types[%i].toObject(m%s,o)', prop, fieldIndex, prop)
			} else {
				var isUnsigned = false
				switch (field.type) {
					case 'double':
					case 'float':
						gen('d%s=o.json&&!isFinite(m%s)?String(m%s):m%s', prop, prop, prop, prop)
						break
					case 'uint64':
						isUnsigned = true
					// eslint-disable-next-line no-fallthrough
					case 'int64':
					case 'sint64':
					case 'fixed64':
					case 'sfixed64':
						gen('if(typeof m%s==="number")', prop)('d%s=o.longs===String?String(m%s):m%s', prop, prop, prop)('else')(
							// Long-like
							'd%s=o.longs===String?util.Long.prototype.toString.call(m%s):o.longs===Number?new util.LongBits(m%s.low>>>0,m%s.high>>>0).toNumber(%s):m%s',
							prop,
							prop,
							prop,
							prop,
							isUnsigned ? 'true' : '',
							prop,
						)
						break
					case 'bytes':
						gen(
							'd%s=o.bytes===String?util.base64.encode(m%s,0,m%s.length):o.bytes===Array?Array.prototype.slice.call(m%s):m%s',
							prop,
							prop,
							prop,
							prop,
							prop,
						)
						break
					default:
						gen('d%s=m%s', prop, prop)
						break
				}
			}
			return gen
			/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
		}

		/**
		 * Generates a runtime message to plain object converter specific to the specified message type.
		 * @param {Type} mtype Message type
		 * @returns {Codegen} Codegen instance
		 */
		converter.toObject = function toObject(mtype) {
			/* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
			var fields = mtype.fieldsArray.slice().sort(util.compareFieldsById)
			if (!fields.length) return util.codegen()('return {}')
			var gen = util.codegen(['m', 'o'], mtype.name + '$toObject')('if(!o)')('o={}')('var d={}')
			var repeatedFields = [],
				mapFields = [],
				normalFields = [],
				i = 0
			for (; i < fields.length; ++i)
				if (!fields[i].partOf)
					(fields[i].resolve().repeated ? repeatedFields : fields[i].map ? mapFields : normalFields).push(fields[i])
			if (repeatedFields.length) {
				gen('if(o.arrays||o.defaults){')
				for (i = 0; i < repeatedFields.length; ++i) gen('d%s=[]', util.safeProp(repeatedFields[i].name))
				gen('}')
			}
			if (mapFields.length) {
				gen('if(o.objects||o.defaults){')
				for (i = 0; i < mapFields.length; ++i) gen('d%s={}', util.safeProp(mapFields[i].name))
				gen('}')
			}
			if (normalFields.length) {
				gen('if(o.defaults){')
				for (i = 0; i < normalFields.length; ++i) {
					var field = normalFields[i],
						prop = util.safeProp(field.name)
					if (field.resolvedType instanceof Enum)
						gen('d%s=o.enums===String?%j:%j', prop, field.resolvedType.valuesById[field.typeDefault], field.typeDefault)
					else if (field.long)
						gen('if(util.Long){')(
							'var n=new util.Long(%i,%i,%j)',
							field.typeDefault.low,
							field.typeDefault.high,
							field.typeDefault.unsigned,
						)(
							'd%s=o.longs===String?n.toString():o.longs===Number?n.toNumber():n',
							prop,
						)('}else')('d%s=o.longs===String?%j:%i', prop, field.typeDefault.toString(), field.typeDefault.toNumber())
					else if (field.bytes) {
						var arrayDefault = '[' + Array.prototype.slice.call(field.typeDefault).join(',') + ']'
						gen('if(o.bytes===String)d%s=%j', prop, String.fromCharCode.apply(String, field.typeDefault))('else{')(
							'd%s=%s',
							prop,
							arrayDefault,
						)(
							'if(o.bytes!==Array)d%s=util.newBuffer(d%s)',
							prop,
							prop,
						)('}')
					} else gen('d%s=%j', prop, field.typeDefault) // also messages (=null)
				}
				gen('}')
			}
			var hasKs2 = false
			for (i = 0; i < fields.length; ++i) {
				var field = fields[i],
					index = mtype._fieldsArray.indexOf(field),
					prop = util.safeProp(field.name)
				if (field.map) {
					if (!hasKs2) {
						hasKs2 = true
						gen('var ks2')
					}
					gen('if(m%s&&(ks2=Object.keys(m%s)).length){', prop, prop)('d%s={}', prop)('for(var j=0;j<ks2.length;++j){')
					genValuePartial_toObject(gen, field, /* sorted */ index, prop + '[ks2[j]]')('}')
				} else if (field.repeated) {
					gen('if(m%s&&m%s.length){', prop, prop)('d%s=[]', prop)('for(var j=0;j<m%s.length;++j){', prop)
					genValuePartial_toObject(gen, field, /* sorted */ index, prop + '[j]')('}')
				} else {
					gen('if(m%s!=null&&m.hasOwnProperty(%j)){', prop, field.name) // !== undefined && !== null
					genValuePartial_toObject(gen, field, /* sorted */ index, prop)
					if (field.partOf) gen('if(o.oneofs)')('d%s=%j', util.safeProp(field.partOf.name), field.name)
				}
				gen('}')
			}
			return gen('return d')
			/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
		}
	})(converter)
	return converter
}

var wrappers = {}

;(function (exports) {
	/**
	 * Wrappers for common types.
	 * @type {Object.<string,IWrapper>}
	 * @const
	 */
	var wrappers = exports
	var Message = message

	/**
	 * From object converter part of an {@link IWrapper}.
	 * @typedef WrapperFromObjectConverter
	 * @type {function}
	 * @param {Object.<string,*>} object Plain object
	 * @returns {Message<{}>} Message instance
	 * @this Type
	 */

	/**
	 * To object converter part of an {@link IWrapper}.
	 * @typedef WrapperToObjectConverter
	 * @type {function}
	 * @param {Message<{}>} message Message instance
	 * @param {IConversionOptions} [options] Conversion options
	 * @returns {Object.<string,*>} Plain object
	 * @this Type
	 */

	/**
	 * Common type wrapper part of {@link wrappers}.
	 * @interface IWrapper
	 * @property {WrapperFromObjectConverter} [fromObject] From object converter
	 * @property {WrapperToObjectConverter} [toObject] To object converter
	 */

	// Custom wrapper for Any
	wrappers['.google.protobuf.Any'] = {
		fromObject: function (object) {
			// unwrap value type if mapped
			if (object && object['@type']) {
				// Only use fully qualified type name after the last '/'
				var name = object['@type'].substring(object['@type'].lastIndexOf('/') + 1)
				var type = this.lookup(name)
				/* istanbul ignore else */
				if (type) {
					// type_url does not accept leading "."
					var type_url = object['@type'].charAt(0) === '.' ? object['@type'].slice(1) : object['@type']
					// type_url prefix is optional, but path seperator is required
					if (type_url.indexOf('/') === -1) {
						type_url = '/' + type_url
					}
					return this.create({
						type_url: type_url,
						value: type.encode(type.fromObject(object)).finish(),
					})
				}
			}
			return this.fromObject(object)
		},
		toObject: function (message, options) {
			// Default prefix
			var googleApi = 'type.googleapis.com/'
			var prefix = ''
			var name = ''

			// decode value if requested and unmapped
			if (options && options.json && message.type_url && message.value) {
				// Only use fully qualified type name after the last '/'
				name = message.type_url.substring(message.type_url.lastIndexOf('/') + 1)
				// Separate the prefix used
				prefix = message.type_url.substring(0, message.type_url.lastIndexOf('/') + 1)
				var type = this.lookup(name)
				/* istanbul ignore else */
				if (type) message = type.decode(message.value)
			}

			// wrap value if unmapped
			if (!(message instanceof this.ctor) && message instanceof Message) {
				var object = message.$type.toObject(message, options)
				var messageName = message.$type.fullName[0] === '.' ? message.$type.fullName.slice(1) : message.$type.fullName
				// Default to type.googleapis.com prefix if no prefix is used
				if (prefix === '') {
					prefix = googleApi
				}
				name = prefix + messageName
				object['@type'] = name
				return object
			}
			return this.toObject(message, options)
		},
	}
})(wrappers)

var type
var hasRequiredType
function requireType() {
	if (hasRequiredType) return type
	hasRequiredType = 1
	type = Type

	// extends Namespace
	var Namespace = requireNamespace()
	;((Type.prototype = Object.create(Namespace.prototype)).constructor = Type).className = 'Type'
	var Enum = require_enum(),
		OneOf = requireOneof(),
		Field = requireField(),
		MapField = requireMapfield(),
		Service = requireService(),
		Message = message,
		Reader = reader,
		Writer = writer,
		util = requireUtil(),
		encoder = requireEncoder(),
		decoder = requireDecoder(),
		verifier = requireVerifier(),
		converter = requireConverter(),
		wrappers$1 = wrappers

	/**
	 * Constructs a new reflected message type instance.
	 * @classdesc Reflected message type.
	 * @extends NamespaceBase
	 * @constructor
	 * @param {string} name Message name
	 * @param {Object.<string,*>} [options] Declared options
	 */
	function Type(name, options) {
		Namespace.call(this, name, options)

		/**
		 * Message fields.
		 * @type {Object.<string,Field>}
		 */
		this.fields = {} // toJSON, marker

		/**
		 * Oneofs declared within this namespace, if any.
		 * @type {Object.<string,OneOf>}
		 */
		this.oneofs = undefined // toJSON

		/**
		 * Extension ranges, if any.
		 * @type {number[][]}
		 */
		this.extensions = undefined // toJSON

		/**
		 * Reserved ranges, if any.
		 * @type {Array.<number[]|string>}
		 */
		this.reserved = undefined // toJSON

		/*?
		 * Whether this type is a legacy group.
		 * @type {boolean|undefined}
		 */
		this.group = undefined // toJSON

		/**
		 * Cached fields by id.
		 * @type {Object.<number,Field>|null}
		 * @private
		 */
		this._fieldsById = null

		/**
		 * Cached fields as an array.
		 * @type {Field[]|null}
		 * @private
		 */
		this._fieldsArray = null

		/**
		 * Cached oneofs as an array.
		 * @type {OneOf[]|null}
		 * @private
		 */
		this._oneofsArray = null

		/**
		 * Cached constructor.
		 * @type {Constructor<{}>}
		 * @private
		 */
		this._ctor = null
	}
	Object.defineProperties(Type.prototype, {
		/**
		 * Message fields by id.
		 * @name Type#fieldsById
		 * @type {Object.<number,Field>}
		 * @readonly
		 */
		fieldsById: {
			get: function () {
				/* istanbul ignore if */
				if (this._fieldsById) return this._fieldsById
				this._fieldsById = {}
				for (var names = Object.keys(this.fields), i = 0; i < names.length; ++i) {
					var field = this.fields[names[i]],
						id = field.id

					/* istanbul ignore if */
					if (this._fieldsById[id]) throw Error('duplicate id ' + id + ' in ' + this)
					this._fieldsById[id] = field
				}
				return this._fieldsById
			},
		},
		/**
		 * Fields of this message as an array for iteration.
		 * @name Type#fieldsArray
		 * @type {Field[]}
		 * @readonly
		 */
		fieldsArray: {
			get: function () {
				return this._fieldsArray || (this._fieldsArray = util.toArray(this.fields))
			},
		},
		/**
		 * Oneofs of this message as an array for iteration.
		 * @name Type#oneofsArray
		 * @type {OneOf[]}
		 * @readonly
		 */
		oneofsArray: {
			get: function () {
				return this._oneofsArray || (this._oneofsArray = util.toArray(this.oneofs))
			},
		},
		/**
		 * The registered constructor, if any registered, otherwise a generic constructor.
		 * Assigning a function replaces the internal constructor. If the function does not extend {@link Message} yet, its prototype will be setup accordingly and static methods will be populated. If it already extends {@link Message}, it will just replace the internal constructor.
		 * @name Type#ctor
		 * @type {Constructor<{}>}
		 */
		ctor: {
			get: function () {
				return this._ctor || (this.ctor = Type.generateConstructor(this)())
			},
			set: function (ctor) {
				// Ensure proper prototype
				var prototype = ctor.prototype
				if (!(prototype instanceof Message)) {
					;(ctor.prototype = new Message()).constructor = ctor
					util.merge(ctor.prototype, prototype)
				}

				// Classes and messages reference their reflected type
				ctor.$type = ctor.prototype.$type = this

				// Mix in static methods
				util.merge(ctor, Message, true)
				this._ctor = ctor

				// Messages have non-enumerable default values on their prototype
				var i = 0
				for (; i < /* initializes */ this.fieldsArray.length; ++i) this._fieldsArray[i].resolve() // ensures a proper value

				// Messages have non-enumerable getters and setters for each virtual oneof field
				var ctorProperties = {}
				for (i = 0; i < /* initializes */ this.oneofsArray.length; ++i)
					ctorProperties[this._oneofsArray[i].resolve().name] = {
						get: util.oneOfGetter(this._oneofsArray[i].oneof),
						set: util.oneOfSetter(this._oneofsArray[i].oneof),
					}
				if (i) Object.defineProperties(ctor.prototype, ctorProperties)
			},
		},
	})

	/**
	 * Generates a constructor function for the specified type.
	 * @param {Type} mtype Message type
	 * @returns {Codegen} Codegen instance
	 */
	Type.generateConstructor = function generateConstructor(mtype) {
		/* eslint-disable no-unexpected-multiline */
		var gen = util.codegen(['p'], mtype.name)
		// explicitly initialize mutable object/array fields so that these aren't just inherited from the prototype
		for (var i = 0, field; i < mtype.fieldsArray.length; ++i)
			if ((field = mtype._fieldsArray[i]).map) gen('this%s={}', util.safeProp(field.name))
			else if (field.repeated) gen('this%s=[]', util.safeProp(field.name))
		return gen('if(p)for(var ks=Object.keys(p),i=0;i<ks.length;++i)if(p[ks[i]]!=null)')(
			// omit undefined or null
			'this[ks[i]]=p[ks[i]]',
		)
		/* eslint-enable no-unexpected-multiline */
	}
	function clearCache(type) {
		type._fieldsById = type._fieldsArray = type._oneofsArray = null
		delete type.encode
		delete type.decode
		delete type.verify
		return type
	}

	/**
	 * Message type descriptor.
	 * @interface IType
	 * @extends INamespace
	 * @property {Object.<string,IOneOf>} [oneofs] Oneof descriptors
	 * @property {Object.<string,IField>} fields Field descriptors
	 * @property {number[][]} [extensions] Extension ranges
	 * @property {Array.<number[]|string>} [reserved] Reserved ranges
	 * @property {boolean} [group=false] Whether a legacy group or not
	 */

	/**
	 * Creates a message type from a message type descriptor.
	 * @param {string} name Message name
	 * @param {IType} json Message type descriptor
	 * @returns {Type} Created message type
	 */
	Type.fromJSON = function fromJSON(name, json) {
		var type = new Type(name, json.options)
		type.extensions = json.extensions
		type.reserved = json.reserved
		var names = Object.keys(json.fields),
			i = 0
		for (; i < names.length; ++i)
			type.add(
				(typeof json.fields[names[i]].keyType !== 'undefined' ? MapField.fromJSON : Field.fromJSON)(
					names[i],
					json.fields[names[i]],
				),
			)
		if (json.oneofs)
			for (names = Object.keys(json.oneofs), i = 0; i < names.length; ++i)
				type.add(OneOf.fromJSON(names[i], json.oneofs[names[i]]))
		if (json.nested)
			for (names = Object.keys(json.nested), i = 0; i < names.length; ++i) {
				var nested = json.nested[names[i]]
				type.add(
					// most to least likely
					(nested.id !== undefined
						? Field.fromJSON
						: nested.fields !== undefined
							? Type.fromJSON
							: nested.values !== undefined
								? Enum.fromJSON
								: nested.methods !== undefined
									? Service.fromJSON
									: Namespace.fromJSON)(names[i], nested),
				)
			}
		if (json.extensions && json.extensions.length) type.extensions = json.extensions
		if (json.reserved && json.reserved.length) type.reserved = json.reserved
		if (json.group) type.group = true
		if (json.comment) type.comment = json.comment
		return type
	}

	/**
	 * Converts this message type to a message type descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IType} Message type descriptor
	 */
	Type.prototype.toJSON = function toJSON(toJSONOptions) {
		var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions)
		var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false
		return util.toObject([
			'options',
			(inherited && inherited.options) || undefined,
			'oneofs',
			Namespace.arrayToJSON(this.oneofsArray, toJSONOptions),
			'fields',
			Namespace.arrayToJSON(
				this.fieldsArray.filter(function (obj) {
					return !obj.declaringField
				}),
				toJSONOptions,
			) || {},
			'extensions',
			this.extensions && this.extensions.length ? this.extensions : undefined,
			'reserved',
			this.reserved && this.reserved.length ? this.reserved : undefined,
			'group',
			this.group || undefined,
			'nested',
			(inherited && inherited.nested) || undefined,
			'comment',
			keepComments ? this.comment : undefined,
		])
	}

	/**
	 * @override
	 */
	Type.prototype.resolveAll = function resolveAll() {
		var fields = this.fieldsArray,
			i = 0
		while (i < fields.length) fields[i++].resolve()
		var oneofs = this.oneofsArray
		i = 0
		while (i < oneofs.length) oneofs[i++].resolve()
		return Namespace.prototype.resolveAll.call(this)
	}

	/**
	 * @override
	 */
	Type.prototype.get = function get(name) {
		return this.fields[name] || (this.oneofs && this.oneofs[name]) || (this.nested && this.nested[name]) || null
	}

	/**
	 * Adds a nested object to this type.
	 * @param {ReflectionObject} object Nested object to add
	 * @returns {Type} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If there is already a nested object with this name or, if a field, when there is already a field with this id
	 */
	Type.prototype.add = function add(object) {
		if (this.get(object.name)) throw Error("duplicate name '" + object.name + "' in " + this)
		if (object instanceof Field && object.extend === undefined) {
			// NOTE: Extension fields aren't actual fields on the declaring type, but nested objects.
			// The root object takes care of adding distinct sister-fields to the respective extended
			// type instead.

			// avoids calling the getter if not absolutely necessary because it's called quite frequently
			if (this._fieldsById ? /* istanbul ignore next */ this._fieldsById[object.id] : this.fieldsById[object.id])
				throw Error('duplicate id ' + object.id + ' in ' + this)
			if (this.isReservedId(object.id)) throw Error('id ' + object.id + ' is reserved in ' + this)
			if (this.isReservedName(object.name)) throw Error("name '" + object.name + "' is reserved in " + this)
			if (object.parent) object.parent.remove(object)
			this.fields[object.name] = object
			object.message = this
			object.onAdd(this)
			return clearCache(this)
		}
		if (object instanceof OneOf) {
			if (!this.oneofs) this.oneofs = {}
			this.oneofs[object.name] = object
			object.onAdd(this)
			return clearCache(this)
		}
		return Namespace.prototype.add.call(this, object)
	}

	/**
	 * Removes a nested object from this type.
	 * @param {ReflectionObject} object Nested object to remove
	 * @returns {Type} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If `object` is not a member of this type
	 */
	Type.prototype.remove = function remove(object) {
		if (object instanceof Field && object.extend === undefined) {
			// See Type#add for the reason why extension fields are excluded here.

			/* istanbul ignore if */
			if (!this.fields || this.fields[object.name] !== object) throw Error(object + ' is not a member of ' + this)
			delete this.fields[object.name]
			object.parent = null
			object.onRemove(this)
			return clearCache(this)
		}
		if (object instanceof OneOf) {
			/* istanbul ignore if */
			if (!this.oneofs || this.oneofs[object.name] !== object) throw Error(object + ' is not a member of ' + this)
			delete this.oneofs[object.name]
			object.parent = null
			object.onRemove(this)
			return clearCache(this)
		}
		return Namespace.prototype.remove.call(this, object)
	}

	/**
	 * Tests if the specified id is reserved.
	 * @param {number} id Id to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Type.prototype.isReservedId = function isReservedId(id) {
		return Namespace.isReservedId(this.reserved, id)
	}

	/**
	 * Tests if the specified name is reserved.
	 * @param {string} name Name to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Type.prototype.isReservedName = function isReservedName(name) {
		return Namespace.isReservedName(this.reserved, name)
	}

	/**
	 * Creates a new message of this type using the specified properties.
	 * @param {Object.<string,*>} [properties] Properties to set
	 * @returns {Message<{}>} Message instance
	 */
	Type.prototype.create = function create(properties) {
		return new this.ctor(properties)
	}

	/**
	 * Sets up {@link Type#encode|encode}, {@link Type#decode|decode} and {@link Type#verify|verify}.
	 * @returns {Type} `this`
	 */
	Type.prototype.setup = function setup() {
		// Sets up everything at once so that the prototype chain does not have to be re-evaluated
		// multiple times (V8, soft-deopt prototype-check).

		var fullName = this.fullName,
			types = []
		for (var i = 0; i < /* initializes */ this.fieldsArray.length; ++i)
			types.push(this._fieldsArray[i].resolve().resolvedType)

		// Replace setup methods with type-specific generated functions
		this.encode = encoder(this)({
			Writer: Writer,
			types: types,
			util: util,
		})
		this.decode = decoder(this)({
			Reader: Reader,
			types: types,
			util: util,
		})
		this.verify = verifier(this)({
			types: types,
			util: util,
		})
		this.fromObject = converter.fromObject(this)({
			types: types,
			util: util,
		})
		this.toObject = converter.toObject(this)({
			types: types,
			util: util,
		})

		// Inject custom wrappers for common types
		var wrapper = wrappers$1[fullName]
		if (wrapper) {
			var originalThis = Object.create(this)
			// if (wrapper.fromObject) {
			originalThis.fromObject = this.fromObject
			this.fromObject = wrapper.fromObject.bind(originalThis)
			// }
			// if (wrapper.toObject) {
			originalThis.toObject = this.toObject
			this.toObject = wrapper.toObject.bind(originalThis)
			// }
		}
		return this
	}

	/**
	 * Encodes a message of this type. Does not implicitly {@link Type#verify|verify} messages.
	 * @param {Message<{}>|Object.<string,*>} message Message instance or plain object
	 * @param {Writer} [writer] Writer to encode to
	 * @returns {Writer} writer
	 */
	Type.prototype.encode = function encode_setup(message, writer) {
		return this.setup().encode(message, writer) // overrides this method
	}

	/**
	 * Encodes a message of this type preceeded by its byte length as a varint. Does not implicitly {@link Type#verify|verify} messages.
	 * @param {Message<{}>|Object.<string,*>} message Message instance or plain object
	 * @param {Writer} [writer] Writer to encode to
	 * @returns {Writer} writer
	 */
	Type.prototype.encodeDelimited = function encodeDelimited(message, writer) {
		return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim()
	}

	/**
	 * Decodes a message of this type.
	 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
	 * @param {number} [length] Length of the message, if known beforehand
	 * @returns {Message<{}>} Decoded message
	 * @throws {Error} If the payload is not a reader or valid buffer
	 * @throws {util.ProtocolError<{}>} If required fields are missing
	 */
	Type.prototype.decode = function decode_setup(reader, length) {
		return this.setup().decode(reader, length) // overrides this method
	}

	/**
	 * Decodes a message of this type preceeded by its byte length as a varint.
	 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
	 * @returns {Message<{}>} Decoded message
	 * @throws {Error} If the payload is not a reader or valid buffer
	 * @throws {util.ProtocolError} If required fields are missing
	 */
	Type.prototype.decodeDelimited = function decodeDelimited(reader) {
		if (!(reader instanceof Reader)) reader = Reader.create(reader)
		return this.decode(reader, reader.uint32())
	}

	/**
	 * Verifies that field values are valid and that required fields are present.
	 * @param {Object.<string,*>} message Plain object to verify
	 * @returns {null|string} `null` if valid, otherwise the reason why it is not
	 */
	Type.prototype.verify = function verify_setup(message) {
		return this.setup().verify(message) // overrides this method
	}

	/**
	 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
	 * @param {Object.<string,*>} object Plain object to convert
	 * @returns {Message<{}>} Message instance
	 */
	Type.prototype.fromObject = function fromObject(object) {
		return this.setup().fromObject(object)
	}

	/**
	 * Conversion options as used by {@link Type#toObject} and {@link Message.toObject}.
	 * @interface IConversionOptions
	 * @property {Function} [longs] Long conversion type.
	 * Valid values are `String` and `Number` (the global types).
	 * Defaults to copy the present value, which is a possibly unsafe number without and a {@link Long} with a long library.
	 * @property {Function} [enums] Enum value conversion type.
	 * Only valid value is `String` (the global type).
	 * Defaults to copy the present value, which is the numeric id.
	 * @property {Function} [bytes] Bytes value conversion type.
	 * Valid values are `Array` and (a base64 encoded) `String` (the global types).
	 * Defaults to copy the present value, which usually is a Buffer under node and an Uint8Array in the browser.
	 * @property {boolean} [defaults=false] Also sets default values on the resulting object
	 * @property {boolean} [arrays=false] Sets empty arrays for missing repeated fields even if `defaults=false`
	 * @property {boolean} [objects=false] Sets empty objects for missing map fields even if `defaults=false`
	 * @property {boolean} [oneofs=false] Includes virtual oneof properties set to the present field's name, if any
	 * @property {boolean} [json=false] Performs additional JSON compatibility conversions, i.e. NaN and Infinity to strings
	 */

	/**
	 * Creates a plain object from a message of this type. Also converts values to other types if specified.
	 * @param {Message<{}>} message Message instance
	 * @param {IConversionOptions} [options] Conversion options
	 * @returns {Object.<string,*>} Plain object
	 */
	Type.prototype.toObject = function toObject(message, options) {
		return this.setup().toObject(message, options)
	}

	/**
	 * Decorator function as returned by {@link Type.d} (TypeScript).
	 * @typedef TypeDecorator
	 * @type {function}
	 * @param {Constructor<T>} target Target constructor
	 * @returns {undefined}
	 * @template T extends Message<T>
	 */

	/**
	 * Type decorator (TypeScript).
	 * @param {string} [typeName] Type name, defaults to the constructor's name
	 * @returns {TypeDecorator<T>} Decorator function
	 * @template T extends Message<T>
	 */
	Type.d = function decorateType(typeName) {
		return function typeDecorator(target) {
			util.decorateType(target, typeName)
		}
	}
	return type
}

var root
var hasRequiredRoot
function requireRoot() {
	if (hasRequiredRoot) return root
	hasRequiredRoot = 1
	root = Root

	// extends Namespace
	var Namespace = requireNamespace()
	;((Root.prototype = Object.create(Namespace.prototype)).constructor = Root).className = 'Root'
	var Field = requireField(),
		Enum = require_enum(),
		OneOf = requireOneof(),
		util = requireUtil()
	var Type,
		// cyclic
		parse,
		// might be excluded
		common // "

	/**
	 * Constructs a new root namespace instance.
	 * @classdesc Root namespace wrapping all types, enums, services, sub-namespaces etc. that belong together.
	 * @extends NamespaceBase
	 * @constructor
	 * @param {Object.<string,*>} [options] Top level options
	 */
	function Root(options) {
		Namespace.call(this, '', options)

		/**
		 * Deferred extension fields.
		 * @type {Field[]}
		 */
		this.deferred = []

		/**
		 * Resolved file names of loaded files.
		 * @type {string[]}
		 */
		this.files = []
	}

	/**
	 * Loads a namespace descriptor into a root namespace.
	 * @param {INamespace} json Nameespace descriptor
	 * @param {Root} [root] Root namespace, defaults to create a new one if omitted
	 * @returns {Root} Root namespace
	 */
	Root.fromJSON = function fromJSON(json, root) {
		if (!root) root = new Root()
		if (json.options) root.setOptions(json.options)
		return root.addJSON(json.nested)
	}

	/**
	 * Resolves the path of an imported file, relative to the importing origin.
	 * This method exists so you can override it with your own logic in case your imports are scattered over multiple directories.
	 * @function
	 * @param {string} origin The file name of the importing file
	 * @param {string} target The file name being imported
	 * @returns {string|null} Resolved path to `target` or `null` to skip the file
	 */
	Root.prototype.resolvePath = util.path.resolve

	/**
	 * Fetch content from file path or url
	 * This method exists so you can override it with your own logic.
	 * @function
	 * @param {string} path File path or url
	 * @param {FetchCallback} callback Callback function
	 * @returns {undefined}
	 */
	Root.prototype.fetch = util.fetch

	// A symbol-like function to safely signal synchronous loading
	/* istanbul ignore next */
	function SYNC() {} // eslint-disable-line no-empty-function

	/**
	 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
	 * @param {string|string[]} filename Names of one or multiple files to load
	 * @param {IParseOptions} options Parse options
	 * @param {LoadCallback} callback Callback function
	 * @returns {undefined}
	 */
	Root.prototype.load = function load(filename, options, callback) {
		if (typeof options === 'function') {
			callback = options
			options = undefined
		}
		var self = this
		if (!callback) return util.asPromise(load, self, filename, options)
		var sync = callback === SYNC // undocumented

		// Finishes loading by calling the callback (exactly once)
		function finish(err, root) {
			/* istanbul ignore if */
			if (!callback) return
			if (sync) throw err
			var cb = callback
			callback = null
			cb(err, root)
		}

		// Bundled definition existence checking
		function getBundledFileName(filename) {
			var idx = filename.lastIndexOf('google/protobuf/')
			if (idx > -1) {
				var altname = filename.substring(idx)
				if (altname in common) return altname
			}
			return null
		}

		// Processes a single file
		function process(filename, source) {
			try {
				if (util.isString(source) && source.charAt(0) === '{') source = JSON.parse(source)
				if (!util.isString(source)) self.setOptions(source.options).addJSON(source.nested)
				else {
					parse.filename = filename
					var parsed = parse(source, self, options),
						resolved,
						i = 0
					if (parsed.imports)
						for (; i < parsed.imports.length; ++i)
							if ((resolved = getBundledFileName(parsed.imports[i]) || self.resolvePath(filename, parsed.imports[i])))
								fetch(resolved)
					if (parsed.weakImports)
						for (i = 0; i < parsed.weakImports.length; ++i)
							if (
								(resolved =
									getBundledFileName(parsed.weakImports[i]) || self.resolvePath(filename, parsed.weakImports[i]))
							)
								fetch(resolved, true)
				}
			} catch (err) {
				finish(err)
			}
			if (!sync && !queued) finish(null, self) // only once anyway
		}

		// Fetches a single file
		function fetch(filename, weak) {
			filename = getBundledFileName(filename) || filename

			// Skip if already loaded / attempted
			if (self.files.indexOf(filename) > -1) return
			self.files.push(filename)

			// Shortcut bundled definitions
			if (filename in common) {
				if (sync) process(filename, common[filename])
				else {
					++queued
					setTimeout(function () {
						--queued
						process(filename, common[filename])
					})
				}
				return
			}

			// Otherwise fetch from disk or network
			if (sync) {
				var source
				try {
					source = util.fs.readFileSync(filename).toString('utf8')
				} catch (err) {
					if (!weak) finish(err)
					return
				}
				process(filename, source)
			} else {
				++queued
				self.fetch(filename, function (err, source) {
					--queued
					/* istanbul ignore if */
					if (!callback) return // terminated meanwhile
					if (err) {
						/* istanbul ignore else */
						if (!weak) finish(err)
						else if (!queued)
							// can't be covered reliably
							finish(null, self)
						return
					}
					process(filename, source)
				})
			}
		}
		var queued = 0

		// Assembling the root namespace doesn't require working type
		// references anymore, so we can load everything in parallel
		if (util.isString(filename)) filename = [filename]
		for (var i = 0, resolved; i < filename.length; ++i)
			if ((resolved = self.resolvePath('', filename[i]))) fetch(resolved)
		if (sync) return self
		if (!queued) finish(null, self)
		return undefined
	}
	// function load(filename:string, options:IParseOptions, callback:LoadCallback):undefined

	/**
	 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
	 * @function Root#load
	 * @param {string|string[]} filename Names of one or multiple files to load
	 * @param {LoadCallback} callback Callback function
	 * @returns {undefined}
	 * @variation 2
	 */
	// function load(filename:string, callback:LoadCallback):undefined

	/**
	 * Loads one or multiple .proto or preprocessed .json files into this root namespace and returns a promise.
	 * @function Root#load
	 * @param {string|string[]} filename Names of one or multiple files to load
	 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
	 * @returns {Promise<Root>} Promise
	 * @variation 3
	 */
	// function load(filename:string, [options:IParseOptions]):Promise<Root>

	/**
	 * Synchronously loads one or multiple .proto or preprocessed .json files into this root namespace (node only).
	 * @function Root#loadSync
	 * @param {string|string[]} filename Names of one or multiple files to load
	 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
	 * @returns {Root} Root namespace
	 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
	 */
	Root.prototype.loadSync = function loadSync(filename, options) {
		if (!util.isNode) throw Error('not supported')
		return this.load(filename, options, SYNC)
	}

	/**
	 * @override
	 */
	Root.prototype.resolveAll = function resolveAll() {
		if (this.deferred.length)
			throw Error(
				'unresolvable extensions: ' +
					this.deferred
						.map(function (field) {
							return "'extend " + field.extend + "' in " + field.parent.fullName
						})
						.join(', '),
			)
		return Namespace.prototype.resolveAll.call(this)
	}

	// only uppercased (and thus conflict-free) children are exposed, see below
	var exposeRe = /^[A-Z]/

	/**
	 * Handles a deferred declaring extension field by creating a sister field to represent it within its extended type.
	 * @param {Root} root Root instance
	 * @param {Field} field Declaring extension field witin the declaring type
	 * @returns {boolean} `true` if successfully added to the extended type, `false` otherwise
	 * @inner
	 * @ignore
	 */
	function tryHandleExtension(root, field) {
		var extendedType = field.parent.lookup(field.extend)
		if (extendedType) {
			var sisterField = new Field(field.fullName, field.id, field.type, field.rule, undefined, field.options)
			//do not allow to extend same field twice to prevent the error
			if (extendedType.get(sisterField.name)) {
				return true
			}
			sisterField.declaringField = field
			field.extensionField = sisterField
			extendedType.add(sisterField)
			return true
		}
		return false
	}

	/**
	 * Called when any object is added to this root or its sub-namespaces.
	 * @param {ReflectionObject} object Object added
	 * @returns {undefined}
	 * @private
	 */
	Root.prototype._handleAdd = function _handleAdd(object) {
		if (object instanceof Field) {
			if (
				/* an extension field (implies not part of a oneof) */ object.extend !== undefined &&
				/* not already handled */ !object.extensionField
			)
				if (!tryHandleExtension(this, object)) this.deferred.push(object)
		} else if (object instanceof Enum) {
			if (exposeRe.test(object.name)) object.parent[object.name] = object.values // expose enum values as property of its parent
		} else if (!(object instanceof OneOf)) {
			/* everything else is a namespace */ if (object instanceof Type)
				// Try to handle any deferred extensions
				for (var i = 0; i < this.deferred.length; )
					if (tryHandleExtension(this, this.deferred[i])) this.deferred.splice(i, 1)
					else ++i
			for (var j = 0; j < /* initializes */ object.nestedArray.length; ++j)
				// recurse into the namespace
				this._handleAdd(object._nestedArray[j])
			if (exposeRe.test(object.name)) object.parent[object.name] = object // expose namespace as property of its parent
		}

		// The above also adds uppercased (and thus conflict-free) nested types, services and enums as
		// properties of namespaces just like static code does. This allows using a .d.ts generated for
		// a static module with reflection-based solutions where the condition is met.
	}

	/**
	 * Called when any object is removed from this root or its sub-namespaces.
	 * @param {ReflectionObject} object Object removed
	 * @returns {undefined}
	 * @private
	 */
	Root.prototype._handleRemove = function _handleRemove(object) {
		if (object instanceof Field) {
			if (/* an extension field */ object.extend !== undefined) {
				if (/* already handled */ object.extensionField) {
					// remove its sister field
					object.extensionField.parent.remove(object.extensionField)
					object.extensionField = null
				} else {
					// cancel the extension
					var index = this.deferred.indexOf(object)
					/* istanbul ignore else */
					if (index > -1) this.deferred.splice(index, 1)
				}
			}
		} else if (object instanceof Enum) {
			if (exposeRe.test(object.name)) delete object.parent[object.name] // unexpose enum values
		} else if (object instanceof Namespace) {
			for (var i = 0; i < /* initializes */ object.nestedArray.length; ++i)
				// recurse into the namespace
				this._handleRemove(object._nestedArray[i])
			if (exposeRe.test(object.name)) delete object.parent[object.name] // unexpose namespaces
		}
	}

	// Sets up cyclic dependencies (called in index-light)
	Root._configure = function (Type_, parse_, common_) {
		Type = Type_
		parse = parse_
		common = common_
	}
	return root
}

var hasRequiredUtil
function requireUtil() {
	if (hasRequiredUtil) return util$2.exports
	hasRequiredUtil = 1

	/**
	 * Various utility functions.
	 * @namespace
	 */
	var util = (util$2.exports = requireMinimal())
	var roots$1 = roots
	var Type,
		// cyclic
		Enum
	util.codegen = requireCodegen()
	util.fetch = requireFetch()
	util.path = requirePath()

	/**
	 * Node's fs module if available.
	 * @type {Object.<string,*>}
	 */
	util.fs = util.inquire('fs')

	/**
	 * Converts an object's values to an array.
	 * @param {Object.<string,*>} object Object to convert
	 * @returns {Array.<*>} Converted array
	 */
	util.toArray = function toArray(object) {
		if (object) {
			var keys = Object.keys(object),
				array = new Array(keys.length),
				index = 0
			while (index < keys.length) array[index] = object[keys[index++]]
			return array
		}
		return []
	}

	/**
	 * Converts an array of keys immediately followed by their respective value to an object, omitting undefined values.
	 * @param {Array.<*>} array Array to convert
	 * @returns {Object.<string,*>} Converted object
	 */
	util.toObject = function toObject(array) {
		var object = {},
			index = 0
		while (index < array.length) {
			var key = array[index++],
				val = array[index++]
			if (val !== undefined) object[key] = val
		}
		return object
	}
	var safePropBackslashRe = /\\/g,
		safePropQuoteRe = /"/g

	/**
	 * Tests whether the specified name is a reserved word in JS.
	 * @param {string} name Name to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	util.isReserved = function isReserved(name) {
		return /^(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$/.test(
			name,
		)
	}

	/**
	 * Returns a safe property accessor for the specified property name.
	 * @param {string} prop Property name
	 * @returns {string} Safe accessor
	 */
	util.safeProp = function safeProp(prop) {
		if (!/^[$\w_]+$/.test(prop) || util.isReserved(prop))
			return '["' + prop.replace(safePropBackslashRe, '\\\\').replace(safePropQuoteRe, '\\"') + '"]'
		return '.' + prop
	}

	/**
	 * Converts the first character of a string to upper case.
	 * @param {string} str String to convert
	 * @returns {string} Converted string
	 */
	util.ucFirst = function ucFirst(str) {
		return str.charAt(0).toUpperCase() + str.substring(1)
	}
	var camelCaseRe = /_([a-z])/g

	/**
	 * Converts a string to camel case.
	 * @param {string} str String to convert
	 * @returns {string} Converted string
	 */
	util.camelCase = function camelCase(str) {
		return (
			str.substring(0, 1) +
			str.substring(1).replace(camelCaseRe, function ($0, $1) {
				return $1.toUpperCase()
			})
		)
	}

	/**
	 * Compares reflected fields by id.
	 * @param {Field} a First field
	 * @param {Field} b Second field
	 * @returns {number} Comparison value
	 */
	util.compareFieldsById = function compareFieldsById(a, b) {
		return a.id - b.id
	}

	/**
	 * Decorator helper for types (TypeScript).
	 * @param {Constructor<T>} ctor Constructor function
	 * @param {string} [typeName] Type name, defaults to the constructor's name
	 * @returns {Type} Reflected type
	 * @template T extends Message<T>
	 * @property {Root} root Decorators root
	 */
	util.decorateType = function decorateType(ctor, typeName) {
		/* istanbul ignore if */
		if (ctor.$type) {
			if (typeName && ctor.$type.name !== typeName) {
				util.decorateRoot.remove(ctor.$type)
				ctor.$type.name = typeName
				util.decorateRoot.add(ctor.$type)
			}
			return ctor.$type
		}

		/* istanbul ignore next */
		if (!Type) Type = requireType()
		var type = new Type(typeName || ctor.name)
		util.decorateRoot.add(type)
		type.ctor = ctor // sets up .encode, .decode etc.
		Object.defineProperty(ctor, '$type', {
			value: type,
			enumerable: false,
		})
		Object.defineProperty(ctor.prototype, '$type', {
			value: type,
			enumerable: false,
		})
		return type
	}
	var decorateEnumIndex = 0

	/**
	 * Decorator helper for enums (TypeScript).
	 * @param {Object} object Enum object
	 * @returns {Enum} Reflected enum
	 */
	util.decorateEnum = function decorateEnum(object) {
		/* istanbul ignore if */
		if (object.$type) return object.$type

		/* istanbul ignore next */
		if (!Enum) Enum = require_enum()
		var enm = new Enum('Enum' + decorateEnumIndex++, object)
		util.decorateRoot.add(enm)
		Object.defineProperty(object, '$type', {
			value: enm,
			enumerable: false,
		})
		return enm
	}

	/**
	 * Sets the value of a property by property path. If a value already exists, it is turned to an array
	 * @param {Object.<string,*>} dst Destination object
	 * @param {string} path dot '.' delimited path of the property to set
	 * @param {Object} value the value to set
	 * @returns {Object.<string,*>} Destination object
	 */
	util.setProperty = function setProperty(dst, path, value) {
		function setProp(dst, path, value) {
			var part = path.shift()
			if (part === '__proto__' || part === 'prototype') {
				return dst
			}
			if (path.length > 0) {
				dst[part] = setProp(dst[part] || {}, path, value)
			} else {
				var prevValue = dst[part]
				if (prevValue) value = [].concat(prevValue).concat(value)
				dst[part] = value
			}
			return dst
		}
		if (typeof dst !== 'object') throw TypeError('dst must be an object')
		if (!path) throw TypeError('path must be specified')
		path = path.split('.')
		return setProp(dst, path, value)
	}

	/**
	 * Decorator root (TypeScript).
	 * @name util.decorateRoot
	 * @type {Root}
	 * @readonly
	 */
	Object.defineProperty(util, 'decorateRoot', {
		get: function () {
			return roots$1['decorated'] || (roots$1['decorated'] = new (requireRoot())())
		},
	})
	return util$2.exports
}

var object
var hasRequiredObject
function requireObject() {
	if (hasRequiredObject) return object
	hasRequiredObject = 1
	object = ReflectionObject
	ReflectionObject.className = 'ReflectionObject'
	var util = requireUtil()
	var Root // cyclic

	/**
	 * Constructs a new reflection object instance.
	 * @classdesc Base class of all reflection objects.
	 * @constructor
	 * @param {string} name Object name
	 * @param {Object.<string,*>} [options] Declared options
	 * @abstract
	 */
	function ReflectionObject(name, options) {
		if (!util.isString(name)) throw TypeError('name must be a string')
		if (options && !util.isObject(options)) throw TypeError('options must be an object')

		/**
		 * Options.
		 * @type {Object.<string,*>|undefined}
		 */
		this.options = options // toJSON

		/**
		 * Parsed Options.
		 * @type {Array.<Object.<string,*>>|undefined}
		 */
		this.parsedOptions = null

		/**
		 * Unique name within its namespace.
		 * @type {string}
		 */
		this.name = name

		/**
		 * Parent namespace.
		 * @type {Namespace|null}
		 */
		this.parent = null

		/**
		 * Whether already resolved or not.
		 * @type {boolean}
		 */
		this.resolved = false

		/**
		 * Comment text, if any.
		 * @type {string|null}
		 */
		this.comment = null

		/**
		 * Defining file name.
		 * @type {string|null}
		 */
		this.filename = null
	}
	Object.defineProperties(ReflectionObject.prototype, {
		/**
		 * Reference to the root namespace.
		 * @name ReflectionObject#root
		 * @type {Root}
		 * @readonly
		 */
		root: {
			get: function () {
				var ptr = this
				while (ptr.parent !== null) ptr = ptr.parent
				return ptr
			},
		},
		/**
		 * Full name including leading dot.
		 * @name ReflectionObject#fullName
		 * @type {string}
		 * @readonly
		 */
		fullName: {
			get: function () {
				var path = [this.name],
					ptr = this.parent
				while (ptr) {
					path.unshift(ptr.name)
					ptr = ptr.parent
				}
				return path.join('.')
			},
		},
	})

	/**
	 * Converts this reflection object to its descriptor representation.
	 * @returns {Object.<string,*>} Descriptor
	 * @abstract
	 */
	ReflectionObject.prototype.toJSON = /* istanbul ignore next */ function toJSON() {
		throw Error() // not implemented, shouldn't happen
	}

	/**
	 * Called when this object is added to a parent.
	 * @param {ReflectionObject} parent Parent added to
	 * @returns {undefined}
	 */
	ReflectionObject.prototype.onAdd = function onAdd(parent) {
		if (this.parent && this.parent !== parent) this.parent.remove(this)
		this.parent = parent
		this.resolved = false
		var root = parent.root
		if (root instanceof Root) root._handleAdd(this)
	}

	/**
	 * Called when this object is removed from a parent.
	 * @param {ReflectionObject} parent Parent removed from
	 * @returns {undefined}
	 */
	ReflectionObject.prototype.onRemove = function onRemove(parent) {
		var root = parent.root
		if (root instanceof Root) root._handleRemove(this)
		this.parent = null
		this.resolved = false
	}

	/**
	 * Resolves this objects type references.
	 * @returns {ReflectionObject} `this`
	 */
	ReflectionObject.prototype.resolve = function resolve() {
		if (this.resolved) return this
		if (this.root instanceof Root) this.resolved = true // only if part of a root
		return this
	}

	/**
	 * Gets an option value.
	 * @param {string} name Option name
	 * @returns {*} Option value or `undefined` if not set
	 */
	ReflectionObject.prototype.getOption = function getOption(name) {
		if (this.options) return this.options[name]
		return undefined
	}

	/**
	 * Sets an option.
	 * @param {string} name Option name
	 * @param {*} value Option value
	 * @param {boolean} [ifNotSet] Sets the option only if it isn't currently set
	 * @returns {ReflectionObject} `this`
	 */
	ReflectionObject.prototype.setOption = function setOption(name, value, ifNotSet) {
		if (!ifNotSet || !this.options || this.options[name] === undefined)
			(this.options || (this.options = {}))[name] = value
		return this
	}

	/**
	 * Sets a parsed option.
	 * @param {string} name parsed Option name
	 * @param {*} value Option value
	 * @param {string} propName dot '.' delimited full path of property within the option to set. if undefined\empty, will add a new option with that value
	 * @returns {ReflectionObject} `this`
	 */
	ReflectionObject.prototype.setParsedOption = function setParsedOption(name, value, propName) {
		if (!this.parsedOptions) {
			this.parsedOptions = []
		}
		var parsedOptions = this.parsedOptions
		if (propName) {
			// If setting a sub property of an option then try to merge it
			// with an existing option
			var opt = parsedOptions.find(function (opt) {
				return Object.prototype.hasOwnProperty.call(opt, name)
			})
			if (opt) {
				// If we found an existing option - just merge the property value
				var newValue = opt[name]
				util.setProperty(newValue, propName, value)
			} else {
				// otherwise, create a new option, set it's property and add it to the list
				opt = {}
				opt[name] = util.setProperty({}, propName, value)
				parsedOptions.push(opt)
			}
		} else {
			// Always create a new option when setting the value of the option itself
			var newOpt = {}
			newOpt[name] = value
			parsedOptions.push(newOpt)
		}
		return this
	}

	/**
	 * Sets multiple options.
	 * @param {Object.<string,*>} options Options to set
	 * @param {boolean} [ifNotSet] Sets an option only if it isn't currently set
	 * @returns {ReflectionObject} `this`
	 */
	ReflectionObject.prototype.setOptions = function setOptions(options, ifNotSet) {
		if (options)
			for (var keys = Object.keys(options), i = 0; i < keys.length; ++i)
				this.setOption(keys[i], options[keys[i]], ifNotSet)
		return this
	}

	/**
	 * Converts this instance to its string representation.
	 * @returns {string} Class name[, space, full name]
	 */
	ReflectionObject.prototype.toString = function toString() {
		var className = this.constructor.className,
			fullName = this.fullName
		if (fullName.length) return className + ' ' + fullName
		return className
	}

	// Sets up cyclic dependencies (called in index-light)
	ReflectionObject._configure = function (Root_) {
		Root = Root_
	}
	return object
}

var _enum
var hasRequired_enum
function require_enum() {
	if (hasRequired_enum) return _enum
	hasRequired_enum = 1
	_enum = Enum

	// extends ReflectionObject
	var ReflectionObject = requireObject()
	;((Enum.prototype = Object.create(ReflectionObject.prototype)).constructor = Enum).className = 'Enum'
	var Namespace = requireNamespace(),
		util = requireUtil()

	/**
	 * Constructs a new enum instance.
	 * @classdesc Reflected enum.
	 * @extends ReflectionObject
	 * @constructor
	 * @param {string} name Unique name within its namespace
	 * @param {Object.<string,number>} [values] Enum values as an object, by name
	 * @param {Object.<string,*>} [options] Declared options
	 * @param {string} [comment] The comment for this enum
	 * @param {Object.<string,string>} [comments] The value comments for this enum
	 * @param {Object.<string,Object<string,*>>|undefined} [valuesOptions] The value options for this enum
	 */
	function Enum(name, values, options, comment, comments, valuesOptions) {
		ReflectionObject.call(this, name, options)
		if (values && typeof values !== 'object') throw TypeError('values must be an object')

		/**
		 * Enum values by id.
		 * @type {Object.<number,string>}
		 */
		this.valuesById = {}

		/**
		 * Enum values by name.
		 * @type {Object.<string,number>}
		 */
		this.values = Object.create(this.valuesById) // toJSON, marker

		/**
		 * Enum comment text.
		 * @type {string|null}
		 */
		this.comment = comment

		/**
		 * Value comment texts, if any.
		 * @type {Object.<string,string>}
		 */
		this.comments = comments || {}

		/**
		 * Values options, if any
		 * @type {Object<string, Object<string, *>>|undefined}
		 */
		this.valuesOptions = valuesOptions

		/**
		 * Reserved ranges, if any.
		 * @type {Array.<number[]|string>}
		 */
		this.reserved = undefined // toJSON

		// Note that values inherit valuesById on their prototype which makes them a TypeScript-
		// compatible enum. This is used by pbts to write actual enum definitions that work for
		// static and reflection code alike instead of emitting generic object definitions.

		if (values)
			for (var keys = Object.keys(values), i = 0; i < keys.length; ++i)
				if (typeof values[keys[i]] === 'number')
					// use forward entries only
					this.valuesById[(this.values[keys[i]] = values[keys[i]])] = keys[i]
	}

	/**
	 * Enum descriptor.
	 * @interface IEnum
	 * @property {Object.<string,number>} values Enum values
	 * @property {Object.<string,*>} [options] Enum options
	 */

	/**
	 * Constructs an enum from an enum descriptor.
	 * @param {string} name Enum name
	 * @param {IEnum} json Enum descriptor
	 * @returns {Enum} Created enum
	 * @throws {TypeError} If arguments are invalid
	 */
	Enum.fromJSON = function fromJSON(name, json) {
		var enm = new Enum(name, json.values, json.options, json.comment, json.comments)
		enm.reserved = json.reserved
		return enm
	}

	/**
	 * Converts this enum to an enum descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IEnum} Enum descriptor
	 */
	Enum.prototype.toJSON = function toJSON(toJSONOptions) {
		var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false
		return util.toObject([
			'options',
			this.options,
			'valuesOptions',
			this.valuesOptions,
			'values',
			this.values,
			'reserved',
			this.reserved && this.reserved.length ? this.reserved : undefined,
			'comment',
			keepComments ? this.comment : undefined,
			'comments',
			keepComments ? this.comments : undefined,
		])
	}

	/**
	 * Adds a value to this enum.
	 * @param {string} name Value name
	 * @param {number} id Value id
	 * @param {string} [comment] Comment, if any
	 * @param {Object.<string, *>|undefined} [options] Options, if any
	 * @returns {Enum} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If there is already a value with this name or id
	 */
	Enum.prototype.add = function add(name, id, comment, options) {
		// utilized by the parser but not by .fromJSON

		if (!util.isString(name)) throw TypeError('name must be a string')
		if (!util.isInteger(id)) throw TypeError('id must be an integer')
		if (this.values[name] !== undefined) throw Error("duplicate name '" + name + "' in " + this)
		if (this.isReservedId(id)) throw Error('id ' + id + ' is reserved in ' + this)
		if (this.isReservedName(name)) throw Error("name '" + name + "' is reserved in " + this)
		if (this.valuesById[id] !== undefined) {
			if (!(this.options && this.options.allow_alias)) throw Error('duplicate id ' + id + ' in ' + this)
			this.values[name] = id
		} else this.valuesById[(this.values[name] = id)] = name
		if (options) {
			if (this.valuesOptions === undefined) this.valuesOptions = {}
			this.valuesOptions[name] = options || null
		}
		this.comments[name] = comment || null
		return this
	}

	/**
	 * Removes a value from this enum
	 * @param {string} name Value name
	 * @returns {Enum} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If `name` is not a name of this enum
	 */
	Enum.prototype.remove = function remove(name) {
		if (!util.isString(name)) throw TypeError('name must be a string')
		var val = this.values[name]
		if (val == null) throw Error("name '" + name + "' does not exist in " + this)
		delete this.valuesById[val]
		delete this.values[name]
		delete this.comments[name]
		if (this.valuesOptions) delete this.valuesOptions[name]
		return this
	}

	/**
	 * Tests if the specified id is reserved.
	 * @param {number} id Id to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Enum.prototype.isReservedId = function isReservedId(id) {
		return Namespace.isReservedId(this.reserved, id)
	}

	/**
	 * Tests if the specified name is reserved.
	 * @param {string} name Name to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Enum.prototype.isReservedName = function isReservedName(name) {
		return Namespace.isReservedName(this.reserved, name)
	}
	return _enum
}

var encoder_1
var hasRequiredEncoder
function requireEncoder() {
	if (hasRequiredEncoder) return encoder_1
	hasRequiredEncoder = 1
	encoder_1 = encoder
	var Enum = require_enum(),
		types = requireTypes(),
		util = requireUtil()

	/**
	 * Generates a partial message type encoder.
	 * @param {Codegen} gen Codegen instance
	 * @param {Field} field Reflected field
	 * @param {number} fieldIndex Field index
	 * @param {string} ref Variable reference
	 * @returns {Codegen} Codegen instance
	 * @ignore
	 */
	function genTypePartial(gen, field, fieldIndex, ref) {
		return field.resolvedType.group
			? gen(
					'types[%i].encode(%s,w.uint32(%i)).uint32(%i)',
					fieldIndex,
					ref,
					((field.id << 3) | 3) >>> 0,
					((field.id << 3) | 4) >>> 0,
				)
			: gen('types[%i].encode(%s,w.uint32(%i).fork()).ldelim()', fieldIndex, ref, ((field.id << 3) | 2) >>> 0)
	}

	/**
	 * Generates an encoder specific to the specified message type.
	 * @param {Type} mtype Message type
	 * @returns {Codegen} Codegen instance
	 */
	function encoder(mtype) {
		/* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
		var gen = util.codegen(['m', 'w'], mtype.name + '$encode')('if(!w)')('w=Writer.create()')
		var i, ref

		// "when a message is serialized its known fields should be written sequentially by field number"
		var fields = /* initializes */ mtype.fieldsArray.slice().sort(util.compareFieldsById)
		for (var i = 0; i < fields.length; ++i) {
			var field = fields[i].resolve(),
				index = mtype._fieldsArray.indexOf(field),
				type = field.resolvedType instanceof Enum ? 'int32' : field.type,
				wireType = types.basic[type]
			ref = 'm' + util.safeProp(field.name)

			// Map fields
			if (field.map) {
				gen(
					'if(%s!=null&&Object.hasOwnProperty.call(m,%j)){',
					ref,
					field.name,
				)(
					// !== undefined && !== null
					'for(var ks=Object.keys(%s),i=0;i<ks.length;++i){',
					ref,
				)(
					'w.uint32(%i).fork().uint32(%i).%s(ks[i])',
					((field.id << 3) | 2) >>> 0,
					8 | types.mapKey[field.keyType],
					field.keyType,
				)
				if (wireType === undefined)
					gen('types[%i].encode(%s[ks[i]],w.uint32(18).fork()).ldelim().ldelim()', index, ref) // can't be groups
				else gen('.uint32(%i).%s(%s[ks[i]]).ldelim()', 16 | wireType, type, ref)
				gen('}')('}')

				// Repeated fields
			} else if (field.repeated) {
				gen('if(%s!=null&&%s.length){', ref, ref) // !== undefined && !== null

				// Packed repeated
				if (field.packed && types.packed[type] !== undefined) {
					gen('w.uint32(%i).fork()', ((field.id << 3) | 2) >>> 0)('for(var i=0;i<%s.length;++i)', ref)(
						'w.%s(%s[i])',
						type,
						ref,
					)('w.ldelim()')

					// Non-packed
				} else {
					gen('for(var i=0;i<%s.length;++i)', ref)
					if (wireType === undefined) genTypePartial(gen, field, index, ref + '[i]')
					else gen('w.uint32(%i).%s(%s[i])', ((field.id << 3) | wireType) >>> 0, type, ref)
				}
				gen('}')

				// Non-repeated
			} else {
				if (field.optional) gen('if(%s!=null&&Object.hasOwnProperty.call(m,%j))', ref, field.name) // !== undefined && !== null

				if (wireType === undefined) genTypePartial(gen, field, index, ref)
				else gen('w.uint32(%i).%s(%s)', ((field.id << 3) | wireType) >>> 0, type, ref)
			}
		}
		return gen('return w')
		/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
	}
	return encoder_1
}

var protobuf$1 = (indexLight.exports = indexMinimal)
protobuf$1.build = 'light'

/**
 * A node-style callback as used by {@link load} and {@link Root#load}.
 * @typedef LoadCallback
 * @type {function}
 * @param {Error|null} error Error, if any, otherwise `null`
 * @param {Root} [root] Root, if there hasn't been an error
 * @returns {undefined}
 */

/**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} root Root namespace, defaults to create a new one if omitted.
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 * @see {@link Root#load}
 */
function load(filename, root, callback) {
	if (typeof root === 'function') {
		callback = root
		root = new protobuf$1.Root()
	} else if (!root) root = new protobuf$1.Root()
	return root.load(filename, callback)
}

/**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
 * @name load
 * @function
 * @param {string|string[]} filename One or multiple files to load
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 * @see {@link Root#load}
 * @variation 2
 */
// function load(filename:string, callback:LoadCallback):undefined

/**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and returns a promise.
 * @name load
 * @function
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
 * @returns {Promise<Root>} Promise
 * @see {@link Root#load}
 * @variation 3
 */
// function load(filename:string, [root:Root]):Promise<Root>

protobuf$1.load = load

/**
 * Synchronously loads one or multiple .proto or preprocessed .json files into a common root namespace (node only).
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
 * @returns {Root} Root namespace
 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
 * @see {@link Root#loadSync}
 */
function loadSync(filename, root) {
	if (!root) root = new protobuf$1.Root()
	return root.loadSync(filename)
}
protobuf$1.loadSync = loadSync

// Serialization
protobuf$1.encoder = requireEncoder()
protobuf$1.decoder = requireDecoder()
protobuf$1.verifier = requireVerifier()
protobuf$1.converter = requireConverter()

// Reflection
protobuf$1.ReflectionObject = requireObject()
protobuf$1.Namespace = requireNamespace()
protobuf$1.Root = requireRoot()
protobuf$1.Enum = require_enum()
protobuf$1.Type = requireType()
protobuf$1.Field = requireField()
protobuf$1.OneOf = requireOneof()
protobuf$1.MapField = requireMapfield()
protobuf$1.Service = requireService()
protobuf$1.Method = requireMethod()

// Runtime
protobuf$1.Message = message
protobuf$1.wrappers = wrappers

// Utility
protobuf$1.types = requireTypes()
protobuf$1.util = requireUtil()

// Set up possibly cyclic reflection dependencies
protobuf$1.ReflectionObject._configure(protobuf$1.Root)
protobuf$1.Namespace._configure(protobuf$1.Type, protobuf$1.Service, protobuf$1.Enum)
protobuf$1.Root._configure(protobuf$1.Type)
protobuf$1.Field._configure(protobuf$1.Type)
var indexLightExports = indexLight.exports

var tokenize_1 = tokenize$1
var delimRe = /[\s{}=;:[\],'"()<>]/g,
	stringDoubleRe = /(?:"([^"\\]*(?:\\.[^"\\]*)*)")/g,
	stringSingleRe = /(?:'([^'\\]*(?:\\.[^'\\]*)*)')/g
var setCommentRe = /^ *[*/]+ */,
	setCommentAltRe = /^\s*\*?\/*/,
	setCommentSplitRe = /\n/g,
	whitespaceRe = /\s/,
	unescapeRe = /\\(.?)/g
var unescapeMap = {
	0: '\0',
	r: '\r',
	n: '\n',
	t: '\t',
}

/**
 * Unescapes a string.
 * @param {string} str String to unescape
 * @returns {string} Unescaped string
 * @property {Object.<string,string>} map Special characters map
 * @memberof tokenize
 */
function unescape(str) {
	return str.replace(unescapeRe, function ($0, $1) {
		switch ($1) {
			case '\\':
			case '':
				return $1
			default:
				return unescapeMap[$1] || ''
		}
	})
}
tokenize$1.unescape = unescape

/**
 * Gets the next token and advances.
 * @typedef TokenizerHandleNext
 * @type {function}
 * @returns {string|null} Next token or `null` on eof
 */

/**
 * Peeks for the next token.
 * @typedef TokenizerHandlePeek
 * @type {function}
 * @returns {string|null} Next token or `null` on eof
 */

/**
 * Pushes a token back to the stack.
 * @typedef TokenizerHandlePush
 * @type {function}
 * @param {string} token Token
 * @returns {undefined}
 */

/**
 * Skips the next token.
 * @typedef TokenizerHandleSkip
 * @type {function}
 * @param {string} expected Expected token
 * @param {boolean} [optional=false] If optional
 * @returns {boolean} Whether the token matched
 * @throws {Error} If the token didn't match and is not optional
 */

/**
 * Gets the comment on the previous line or, alternatively, the line comment on the specified line.
 * @typedef TokenizerHandleCmnt
 * @type {function}
 * @param {number} [line] Line number
 * @returns {string|null} Comment text or `null` if none
 */

/**
 * Handle object returned from {@link tokenize}.
 * @interface ITokenizerHandle
 * @property {TokenizerHandleNext} next Gets the next token and advances (`null` on eof)
 * @property {TokenizerHandlePeek} peek Peeks for the next token (`null` on eof)
 * @property {TokenizerHandlePush} push Pushes a token back to the stack
 * @property {TokenizerHandleSkip} skip Skips a token, returns its presence and advances or, if non-optional and not present, throws
 * @property {TokenizerHandleCmnt} cmnt Gets the comment on the previous line or the line comment on the specified line, if any
 * @property {number} line Current line number
 */

/**
 * Tokenizes the given .proto source and returns an object with useful utility functions.
 * @param {string} source Source contents
 * @param {boolean} alternateCommentMode Whether we should activate alternate comment parsing mode.
 * @returns {ITokenizerHandle} Tokenizer handle
 */
function tokenize$1(source, alternateCommentMode) {
	/* eslint-disable callback-return */
	source = source.toString()
	var offset = 0,
		length = source.length,
		line = 1,
		lastCommentLine = 0,
		comments = {}
	var stack = []
	var stringDelim = null

	/* istanbul ignore next */
	/**
	 * Creates an error for illegal syntax.
	 * @param {string} subject Subject
	 * @returns {Error} Error created
	 * @inner
	 */
	function illegal(subject) {
		return Error('illegal ' + subject + ' (line ' + line + ')')
	}

	/**
	 * Reads a string till its end.
	 * @returns {string} String read
	 * @inner
	 */
	function readString() {
		var re = stringDelim === "'" ? stringSingleRe : stringDoubleRe
		re.lastIndex = offset - 1
		var match = re.exec(source)
		if (!match) throw illegal('string')
		offset = re.lastIndex
		push(stringDelim)
		stringDelim = null
		return unescape(match[1])
	}

	/**
	 * Gets the character at `pos` within the source.
	 * @param {number} pos Position
	 * @returns {string} Character
	 * @inner
	 */
	function charAt(pos) {
		return source.charAt(pos)
	}

	/**
	 * Sets the current comment text.
	 * @param {number} start Start offset
	 * @param {number} end End offset
	 * @param {boolean} isLeading set if a leading comment
	 * @returns {undefined}
	 * @inner
	 */
	function setComment(start, end, isLeading) {
		var comment = {
			type: source.charAt(start++),
			lineEmpty: false,
			leading: isLeading,
		}
		var lookback
		if (alternateCommentMode) {
			lookback = 2 // alternate comment parsing: "//" or "/*"
		} else {
			lookback = 3 // "///" or "/**"
		}
		var commentOffset = start - lookback,
			c
		do {
			if (--commentOffset < 0 || (c = source.charAt(commentOffset)) === '\n') {
				comment.lineEmpty = true
				break
			}
		} while (c === ' ' || c === '\t')
		var lines = source.substring(start, end).split(setCommentSplitRe)
		for (var i = 0; i < lines.length; ++i)
			lines[i] = lines[i].replace(alternateCommentMode ? setCommentAltRe : setCommentRe, '').trim()
		comment.text = lines.join('\n').trim()
		comments[line] = comment
		lastCommentLine = line
	}
	function isDoubleSlashCommentLine(startOffset) {
		var endOffset = findEndOfLine(startOffset)

		// see if remaining line matches comment pattern
		var lineText = source.substring(startOffset, endOffset)
		var isComment = /^\s*\/\//.test(lineText)
		return isComment
	}
	function findEndOfLine(cursor) {
		// find end of cursor's line
		var endOffset = cursor
		while (endOffset < length && charAt(endOffset) !== '\n') {
			endOffset++
		}
		return endOffset
	}

	/**
	 * Obtains the next token.
	 * @returns {string|null} Next token or `null` on eof
	 * @inner
	 */
	function next() {
		if (stack.length > 0) return stack.shift()
		if (stringDelim) return readString()
		var repeat,
			prev,
			curr,
			start,
			isDoc,
			isLeadingComment = offset === 0
		do {
			if (offset === length) return null
			repeat = false
			while (whitespaceRe.test((curr = charAt(offset)))) {
				if (curr === '\n') {
					isLeadingComment = true
					++line
				}
				if (++offset === length) return null
			}
			if (charAt(offset) === '/') {
				if (++offset === length) {
					throw illegal('comment')
				}
				if (charAt(offset) === '/') {
					// Line
					if (!alternateCommentMode) {
						// check for triple-slash comment
						isDoc = charAt((start = offset + 1)) === '/'
						while (charAt(++offset) !== '\n') {
							if (offset === length) {
								return null
							}
						}
						++offset
						if (isDoc) {
							setComment(start, offset - 1, isLeadingComment)
							// Trailing comment cannot not be multi-line,
							// so leading comment state should be reset to handle potential next comments
							isLeadingComment = true
						}
						++line
						repeat = true
					} else {
						// check for double-slash comments, consolidating consecutive lines
						start = offset
						isDoc = false
						if (isDoubleSlashCommentLine(offset - 1)) {
							isDoc = true
							do {
								offset = findEndOfLine(offset)
								if (offset === length) {
									break
								}
								offset++
								if (!isLeadingComment) {
									// Trailing comment cannot not be multi-line
									break
								}
							} while (isDoubleSlashCommentLine(offset))
						} else {
							offset = Math.min(length, findEndOfLine(offset) + 1)
						}
						if (isDoc) {
							setComment(start, offset, isLeadingComment)
							isLeadingComment = true
						}
						line++
						repeat = true
					}
				} else if ((curr = charAt(offset)) === '*') {
					/* Block */
					// check for /** (regular comment mode) or /* (alternate comment mode)
					start = offset + 1
					isDoc = alternateCommentMode || charAt(start) === '*'
					do {
						if (curr === '\n') {
							++line
						}
						if (++offset === length) {
							throw illegal('comment')
						}
						prev = curr
						curr = charAt(offset)
					} while (prev !== '*' || curr !== '/')
					++offset
					if (isDoc) {
						setComment(start, offset - 2, isLeadingComment)
						isLeadingComment = true
					}
					repeat = true
				} else {
					return '/'
				}
			}
		} while (repeat)

		// offset !== length if we got here

		var end = offset
		delimRe.lastIndex = 0
		var delim = delimRe.test(charAt(end++))
		if (!delim) while (end < length && !delimRe.test(charAt(end))) ++end
		var token = source.substring(offset, (offset = end))
		if (token === '"' || token === "'") stringDelim = token
		return token
	}

	/**
	 * Pushes a token back to the stack.
	 * @param {string} token Token
	 * @returns {undefined}
	 * @inner
	 */
	function push(token) {
		stack.push(token)
	}

	/**
	 * Peeks for the next token.
	 * @returns {string|null} Token or `null` on eof
	 * @inner
	 */
	function peek() {
		if (!stack.length) {
			var token = next()
			if (token === null) return null
			push(token)
		}
		return stack[0]
	}

	/**
	 * Skips a token.
	 * @param {string} expected Expected token
	 * @param {boolean} [optional=false] Whether the token is optional
	 * @returns {boolean} `true` when skipped, `false` if not
	 * @throws {Error} When a required token is not present
	 * @inner
	 */
	function skip(expected, optional) {
		var actual = peek(),
			equals = actual === expected
		if (equals) {
			next()
			return true
		}
		if (!optional) throw illegal("token '" + actual + "', '" + expected + "' expected")
		return false
	}

	/**
	 * Gets a comment.
	 * @param {number} [trailingLine] Line number if looking for a trailing comment
	 * @returns {string|null} Comment text
	 * @inner
	 */
	function cmnt(trailingLine) {
		var ret = null
		var comment
		if (trailingLine === undefined) {
			comment = comments[line - 1]
			delete comments[line - 1]
			if (comment && (alternateCommentMode || comment.type === '*' || comment.lineEmpty)) {
				ret = comment.leading ? comment.text : null
			}
		} else {
			/* istanbul ignore else */
			if (lastCommentLine < trailingLine) {
				peek()
			}
			comment = comments[trailingLine]
			delete comments[trailingLine]
			if (comment && !comment.lineEmpty && (alternateCommentMode || comment.type === '/')) {
				ret = comment.leading ? null : comment.text
			}
		}
		return ret
	}
	return Object.defineProperty(
		{
			next: next,
			peek: peek,
			push: push,
			skip: skip,
			cmnt: cmnt,
		},
		'line',
		{
			get: function () {
				return line
			},
		},
	)
	/* eslint-enable callback-return */
}

var parse_1 = parse
parse.filename = null
parse.defaults = {
	keepCase: false,
}
var tokenize = tokenize_1,
	Root = requireRoot(),
	Type = requireType(),
	Field = requireField(),
	MapField = requireMapfield(),
	OneOf = requireOneof(),
	Enum = require_enum(),
	Service = requireService(),
	Method = requireMethod(),
	types = requireTypes(),
	util = requireUtil()
var base10Re = /^[1-9][0-9]*$/,
	base10NegRe = /^-?[1-9][0-9]*$/,
	base16Re = /^0[x][0-9a-fA-F]+$/,
	base16NegRe = /^-?0[x][0-9a-fA-F]+$/,
	base8Re = /^0[0-7]+$/,
	base8NegRe = /^-?0[0-7]+$/,
	numberRe = /^(?![eE])[0-9]*(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?$/,
	nameRe = /^[a-zA-Z_][a-zA-Z_0-9]*$/,
	typeRefRe = /^(?:\.?[a-zA-Z_][a-zA-Z_0-9]*)(?:\.[a-zA-Z_][a-zA-Z_0-9]*)*$/,
	fqTypeRefRe = /^(?:\.[a-zA-Z_][a-zA-Z_0-9]*)+$/

/**
 * Result object returned from {@link parse}.
 * @interface IParserResult
 * @property {string|undefined} package Package name, if declared
 * @property {string[]|undefined} imports Imports, if any
 * @property {string[]|undefined} weakImports Weak imports, if any
 * @property {string|undefined} syntax Syntax, if specified (either `"proto2"` or `"proto3"`)
 * @property {Root} root Populated root instance
 */

/**
 * Options modifying the behavior of {@link parse}.
 * @interface IParseOptions
 * @property {boolean} [keepCase=false] Keeps field casing instead of converting to camel case
 * @property {boolean} [alternateCommentMode=false] Recognize double-slash comments in addition to doc-block comments.
 * @property {boolean} [preferTrailingComment=false] Use trailing comment when both leading comment and trailing comment exist.
 */

/**
 * Options modifying the behavior of JSON serialization.
 * @interface IToJSONOptions
 * @property {boolean} [keepComments=false] Serializes comments.
 */

/**
 * Parses the given .proto source and returns an object with the parsed contents.
 * @param {string} source Source contents
 * @param {Root} root Root to populate
 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {IParserResult} Parser result
 * @property {string} filename=null Currently processing file name for error reporting, if known
 * @property {IParseOptions} defaults Default {@link IParseOptions}
 */
function parse(source, root, options) {
	/* eslint-disable callback-return */
	if (!(root instanceof Root)) {
		options = root
		root = new Root()
	}
	if (!options) options = parse.defaults
	var preferTrailingComment = options.preferTrailingComment || false
	var tn = tokenize(source, options.alternateCommentMode || false),
		next = tn.next,
		push = tn.push,
		peek = tn.peek,
		skip = tn.skip,
		cmnt = tn.cmnt
	var head = true,
		pkg,
		imports,
		weakImports,
		syntax,
		isProto3 = false
	var ptr = root
	var applyCase = options.keepCase
		? function (name) {
				return name
			}
		: util.camelCase

	/* istanbul ignore next */
	function illegal(token, name, insideTryCatch) {
		var filename = parse.filename
		if (!insideTryCatch) parse.filename = null
		return Error(
			'illegal ' +
				(name || 'token') +
				" '" +
				token +
				"' (" +
				(filename ? filename + ', ' : '') +
				'line ' +
				tn.line +
				')',
		)
	}
	function readString() {
		var values = [],
			token
		do {
			/* istanbul ignore if */
			if ((token = next()) !== '"' && token !== "'") throw illegal(token)
			values.push(next())
			skip(token)
			token = peek()
		} while (token === '"' || token === "'")
		return values.join('')
	}
	function readValue(acceptTypeRef) {
		var token = next()
		switch (token) {
			case "'":
			case '"':
				push(token)
				return readString()
			case 'true':
			case 'TRUE':
				return true
			case 'false':
			case 'FALSE':
				return false
		}
		try {
			return parseNumber(token, /* insideTryCatch */ true)
		} catch (e) {
			/* istanbul ignore else */
			if (typeRefRe.test(token)) return token

			/* istanbul ignore next */
			throw illegal(token, 'value')
		}
	}
	function readRanges(target, acceptStrings) {
		var token, start
		do {
			if (acceptStrings && ((token = peek()) === '"' || token === "'")) target.push(readString())
			else target.push([(start = parseId(next())), skip('to', true) ? parseId(next()) : start])
		} while (skip(',', true))
		var dummy = {
			options: undefined,
		}
		dummy.setOption = function (name, value) {
			if (this.options === undefined) this.options = {}
			this.options[name] = value
		}
		ifBlock(
			dummy,
			function parseRange_block(token) {
				/* istanbul ignore else */
				if (token === 'option') {
					parseOption(dummy, token) // skip
					skip(';')
				} else throw illegal(token)
			},
			function parseRange_line() {
				parseInlineOptions(dummy) // skip
			},
		)
	}
	function parseNumber(token, insideTryCatch) {
		var sign = 1
		if (token.charAt(0) === '-') {
			sign = -1
			token = token.substring(1)
		}
		switch (token) {
			case 'inf':
			case 'INF':
			case 'Inf':
				return sign * Infinity
			case 'nan':
			case 'NAN':
			case 'Nan':
			case 'NaN':
				return NaN
			case '0':
				return 0
		}
		if (base10Re.test(token)) return sign * parseInt(token, 10)
		if (base16Re.test(token)) return sign * parseInt(token, 16)
		if (base8Re.test(token)) return sign * parseInt(token, 8)

		/* istanbul ignore else */
		if (numberRe.test(token)) return sign * parseFloat(token)

		/* istanbul ignore next */
		throw illegal(token, 'number', insideTryCatch)
	}
	function parseId(token, acceptNegative) {
		switch (token) {
			case 'max':
			case 'MAX':
			case 'Max':
				return 536870911
			case '0':
				return 0
		}

		/* istanbul ignore if */
		if (!acceptNegative && token.charAt(0) === '-') throw illegal(token, 'id')
		if (base10NegRe.test(token)) return parseInt(token, 10)
		if (base16NegRe.test(token)) return parseInt(token, 16)

		/* istanbul ignore else */
		if (base8NegRe.test(token)) return parseInt(token, 8)

		/* istanbul ignore next */
		throw illegal(token, 'id')
	}
	function parsePackage() {
		/* istanbul ignore if */
		if (pkg !== undefined) throw illegal('package')
		pkg = next()

		/* istanbul ignore if */
		if (!typeRefRe.test(pkg)) throw illegal(pkg, 'name')
		ptr = ptr.define(pkg)
		skip(';')
	}
	function parseImport() {
		var token = peek()
		var whichImports
		switch (token) {
			case 'weak':
				whichImports = weakImports || (weakImports = [])
				next()
				break
			case 'public':
				next()
			// eslint-disable-next-line no-fallthrough
			default:
				whichImports = imports || (imports = [])
				break
		}
		token = readString()
		skip(';')
		whichImports.push(token)
	}
	function parseSyntax() {
		skip('=')
		syntax = readString()
		isProto3 = syntax === 'proto3'

		/* istanbul ignore if */
		if (!isProto3 && syntax !== 'proto2') throw illegal(syntax, 'syntax')

		// Syntax is needed to understand the meaning of the optional field rule
		// Otherwise the meaning is ambiguous between proto2 and proto3
		root.setOption('syntax', syntax)
		skip(';')
	}
	function parseCommon(parent, token) {
		switch (token) {
			case 'option':
				parseOption(parent, token)
				skip(';')
				return true
			case 'message':
				parseType(parent, token)
				return true
			case 'enum':
				parseEnum(parent, token)
				return true
			case 'service':
				parseService(parent, token)
				return true
			case 'extend':
				parseExtension(parent, token)
				return true
		}
		return false
	}
	function ifBlock(obj, fnIf, fnElse) {
		var trailingLine = tn.line
		if (obj) {
			if (typeof obj.comment !== 'string') {
				obj.comment = cmnt() // try block-type comment
			}
			obj.filename = parse.filename
		}
		if (skip('{', true)) {
			var token
			while ((token = next()) !== '}') fnIf(token)
			skip(';', true)
		} else {
			if (fnElse) fnElse()
			skip(';')
			if (obj && (typeof obj.comment !== 'string' || preferTrailingComment))
				obj.comment = cmnt(trailingLine) || obj.comment // try line-type comment
		}
	}
	function parseType(parent, token) {
		/* istanbul ignore if */
		if (!nameRe.test((token = next()))) throw illegal(token, 'type name')
		var type = new Type(token)
		ifBlock(type, function parseType_block(token) {
			if (parseCommon(type, token)) return
			switch (token) {
				case 'map':
					parseMapField(type)
					break
				case 'required':
				case 'repeated':
					parseField(type, token)
					break
				case 'optional':
					/* istanbul ignore if */
					if (isProto3) {
						parseField(type, 'proto3_optional')
					} else {
						parseField(type, 'optional')
					}
					break
				case 'oneof':
					parseOneOf(type, token)
					break
				case 'extensions':
					readRanges(type.extensions || (type.extensions = []))
					break
				case 'reserved':
					readRanges(type.reserved || (type.reserved = []), true)
					break
				default:
					/* istanbul ignore if */
					if (!isProto3 || !typeRefRe.test(token)) throw illegal(token)
					push(token)
					parseField(type, 'optional')
					break
			}
		})
		parent.add(type)
	}
	function parseField(parent, rule, extend) {
		var type = next()
		if (type === 'group') {
			parseGroup(parent, rule)
			return
		}
		// Type names can consume multiple tokens, in multiple variants:
		//    package.subpackage   field       tokens: "package.subpackage" [TYPE NAME ENDS HERE] "field"
		//    package . subpackage field       tokens: "package" "." "subpackage" [TYPE NAME ENDS HERE] "field"
		//    package.  subpackage field       tokens: "package." "subpackage" [TYPE NAME ENDS HERE] "field"
		//    package  .subpackage field       tokens: "package" ".subpackage" [TYPE NAME ENDS HERE] "field"
		// Keep reading tokens until we get a type name with no period at the end,
		// and the next token does not start with a period.
		while (type.endsWith('.') || peek().startsWith('.')) {
			type += next()
		}

		/* istanbul ignore if */
		if (!typeRefRe.test(type)) throw illegal(type, 'type')
		var name = next()

		/* istanbul ignore if */
		if (!nameRe.test(name)) throw illegal(name, 'name')
		name = applyCase(name)
		skip('=')
		var field = new Field(name, parseId(next()), type, rule, extend)
		ifBlock(
			field,
			function parseField_block(token) {
				/* istanbul ignore else */
				if (token === 'option') {
					parseOption(field, token)
					skip(';')
				} else throw illegal(token)
			},
			function parseField_line() {
				parseInlineOptions(field)
			},
		)
		if (rule === 'proto3_optional') {
			// for proto3 optional fields, we create a single-member Oneof to mimic "optional" behavior
			var oneof = new OneOf('_' + name)
			field.setOption('proto3_optional', true)
			oneof.add(field)
			parent.add(oneof)
		} else {
			parent.add(field)
		}

		// JSON defaults to packed=true if not set so we have to set packed=false explicity when
		// parsing proto2 descriptors without the option, where applicable. This must be done for
		// all known packable types and anything that could be an enum (= is not a basic type).
		if (!isProto3 && field.repeated && (types.packed[type] !== undefined || types.basic[type] === undefined))
			field.setOption('packed', false, /* ifNotSet */ true)
	}
	function parseGroup(parent, rule) {
		var name = next()

		/* istanbul ignore if */
		if (!nameRe.test(name)) throw illegal(name, 'name')
		var fieldName = util.lcFirst(name)
		if (name === fieldName) name = util.ucFirst(name)
		skip('=')
		var id = parseId(next())
		var type = new Type(name)
		type.group = true
		var field = new Field(fieldName, id, name, rule)
		field.filename = parse.filename
		ifBlock(type, function parseGroup_block(token) {
			switch (token) {
				case 'option':
					parseOption(type, token)
					skip(';')
					break
				case 'required':
				case 'repeated':
					parseField(type, token)
					break
				case 'optional':
					/* istanbul ignore if */
					if (isProto3) {
						parseField(type, 'proto3_optional')
					} else {
						parseField(type, 'optional')
					}
					break
				case 'message':
					parseType(type, token)
					break
				case 'enum':
					parseEnum(type, token)
					break

				/* istanbul ignore next */
				default:
					throw illegal(token)
				// there are no groups with proto3 semantics
			}
		})
		parent.add(type).add(field)
	}
	function parseMapField(parent) {
		skip('<')
		var keyType = next()

		/* istanbul ignore if */
		if (types.mapKey[keyType] === undefined) throw illegal(keyType, 'type')
		skip(',')
		var valueType = next()

		/* istanbul ignore if */
		if (!typeRefRe.test(valueType)) throw illegal(valueType, 'type')
		skip('>')
		var name = next()

		/* istanbul ignore if */
		if (!nameRe.test(name)) throw illegal(name, 'name')
		skip('=')
		var field = new MapField(applyCase(name), parseId(next()), keyType, valueType)
		ifBlock(
			field,
			function parseMapField_block(token) {
				/* istanbul ignore else */
				if (token === 'option') {
					parseOption(field, token)
					skip(';')
				} else throw illegal(token)
			},
			function parseMapField_line() {
				parseInlineOptions(field)
			},
		)
		parent.add(field)
	}
	function parseOneOf(parent, token) {
		/* istanbul ignore if */
		if (!nameRe.test((token = next()))) throw illegal(token, 'name')
		var oneof = new OneOf(applyCase(token))
		ifBlock(oneof, function parseOneOf_block(token) {
			if (token === 'option') {
				parseOption(oneof, token)
				skip(';')
			} else {
				push(token)
				parseField(oneof, 'optional')
			}
		})
		parent.add(oneof)
	}
	function parseEnum(parent, token) {
		/* istanbul ignore if */
		if (!nameRe.test((token = next()))) throw illegal(token, 'name')
		var enm = new Enum(token)
		ifBlock(enm, function parseEnum_block(token) {
			switch (token) {
				case 'option':
					parseOption(enm, token)
					skip(';')
					break
				case 'reserved':
					readRanges(enm.reserved || (enm.reserved = []), true)
					break
				default:
					parseEnumValue(enm, token)
			}
		})
		parent.add(enm)
	}
	function parseEnumValue(parent, token) {
		/* istanbul ignore if */
		if (!nameRe.test(token)) throw illegal(token, 'name')
		skip('=')
		var value = parseId(next(), true),
			dummy = {
				options: undefined,
			}
		dummy.setOption = function (name, value) {
			if (this.options === undefined) this.options = {}
			this.options[name] = value
		}
		ifBlock(
			dummy,
			function parseEnumValue_block(token) {
				/* istanbul ignore else */
				if (token === 'option') {
					parseOption(dummy, token) // skip
					skip(';')
				} else throw illegal(token)
			},
			function parseEnumValue_line() {
				parseInlineOptions(dummy) // skip
			},
		)
		parent.add(token, value, dummy.comment, dummy.options)
	}
	function parseOption(parent, token) {
		var isCustom = skip('(', true)

		/* istanbul ignore if */
		if (!typeRefRe.test((token = next()))) throw illegal(token, 'name')
		var name = token
		var option = name
		var propName
		if (isCustom) {
			skip(')')
			name = '(' + name + ')'
			option = name
			token = peek()
			if (fqTypeRefRe.test(token)) {
				propName = token.slice(1) //remove '.' before property name
				name += token
				next()
			}
		}
		skip('=')
		var optionValue = parseOptionValue(parent, name)
		setParsedOption(parent, option, optionValue, propName)
	}
	function parseOptionValue(parent, name) {
		// { a: "foo" b { c: "bar" } }
		if (skip('{', true)) {
			var objectResult = {}
			while (!skip('}', true)) {
				/* istanbul ignore if */
				if (!nameRe.test((token = next()))) {
					throw illegal(token, 'name')
				}
				if (token === null) {
					throw illegal(token, 'end of input')
				}
				var value
				var propName = token
				skip(':', true)
				if (peek() === '{') value = parseOptionValue(parent, name + '.' + token)
				else if (peek() === '[') {
					// option (my_option) = {
					//     repeated_value: [ "foo", "bar" ]
					// };
					value = []
					var lastValue
					if (skip('[', true)) {
						do {
							lastValue = readValue()
							value.push(lastValue)
						} while (skip(',', true))
						skip(']')
						if (typeof lastValue !== 'undefined') {
							setOption(parent, name + '.' + token, lastValue)
						}
					}
				} else {
					value = readValue()
					setOption(parent, name + '.' + token, value)
				}
				var prevValue = objectResult[propName]
				if (prevValue) value = [].concat(prevValue).concat(value)
				objectResult[propName] = value

				// Semicolons and commas can be optional
				skip(',', true)
				skip(';', true)
			}
			return objectResult
		}
		var simpleValue = readValue()
		setOption(parent, name, simpleValue)
		return simpleValue
		// Does not enforce a delimiter to be universal
	}
	function setOption(parent, name, value) {
		if (parent.setOption) parent.setOption(name, value)
	}
	function setParsedOption(parent, name, value, propName) {
		if (parent.setParsedOption) parent.setParsedOption(name, value, propName)
	}
	function parseInlineOptions(parent) {
		if (skip('[', true)) {
			do {
				parseOption(parent, 'option')
			} while (skip(',', true))
			skip(']')
		}
		return parent
	}
	function parseService(parent, token) {
		/* istanbul ignore if */
		if (!nameRe.test((token = next()))) throw illegal(token, 'service name')
		var service = new Service(token)
		ifBlock(service, function parseService_block(token) {
			if (parseCommon(service, token)) return

			/* istanbul ignore else */
			if (token === 'rpc') parseMethod(service, token)
			else throw illegal(token)
		})
		parent.add(service)
	}
	function parseMethod(parent, token) {
		// Get the comment of the preceding line now (if one exists) in case the
		// method is defined across multiple lines.
		var commentText = cmnt()
		var type = token

		/* istanbul ignore if */
		if (!nameRe.test((token = next()))) throw illegal(token, 'name')
		var name = token,
			requestType,
			requestStream,
			responseType,
			responseStream
		skip('(')
		if (skip('stream', true)) requestStream = true

		/* istanbul ignore if */
		if (!typeRefRe.test((token = next()))) throw illegal(token)
		requestType = token
		skip(')')
		skip('returns')
		skip('(')
		if (skip('stream', true)) responseStream = true

		/* istanbul ignore if */
		if (!typeRefRe.test((token = next()))) throw illegal(token)
		responseType = token
		skip(')')
		var method = new Method(name, type, requestType, responseType, requestStream, responseStream)
		method.comment = commentText
		ifBlock(method, function parseMethod_block(token) {
			/* istanbul ignore else */
			if (token === 'option') {
				parseOption(method, token)
				skip(';')
			} else throw illegal(token)
		})
		parent.add(method)
	}
	function parseExtension(parent, token) {
		/* istanbul ignore if */
		if (!typeRefRe.test((token = next()))) throw illegal(token, 'reference')
		var reference = token
		ifBlock(null, function parseExtension_block(token) {
			switch (token) {
				case 'required':
				case 'repeated':
					parseField(parent, token, reference)
					break
				case 'optional':
					/* istanbul ignore if */
					if (isProto3) {
						parseField(parent, 'proto3_optional', reference)
					} else {
						parseField(parent, 'optional', reference)
					}
					break
				default:
					/* istanbul ignore if */
					if (!isProto3 || !typeRefRe.test(token)) throw illegal(token)
					push(token)
					parseField(parent, 'optional', reference)
					break
			}
		})
	}
	var token
	while ((token = next()) !== null) {
		switch (token) {
			case 'package':
				/* istanbul ignore if */
				if (!head) throw illegal(token)
				parsePackage()
				break
			case 'import':
				/* istanbul ignore if */
				if (!head) throw illegal(token)
				parseImport()
				break
			case 'syntax':
				/* istanbul ignore if */
				if (!head) throw illegal(token)
				parseSyntax()
				break
			case 'option':
				parseOption(ptr, token)
				skip(';')
				break
			default:
				/* istanbul ignore else */
				if (parseCommon(ptr, token)) {
					head = false
					continue
				}

				/* istanbul ignore next */
				throw illegal(token)
		}
	}
	parse.filename = null
	return {
		package: pkg,
		imports: imports,
		weakImports: weakImports,
		syntax: syntax,
		root: root,
	}
}

var common_1 = common
var commonRe = /\/|\./

/**
 * Provides common type definitions.
 * Can also be used to provide additional google types or your own custom types.
 * @param {string} name Short name as in `google/protobuf/[name].proto` or full file name
 * @param {Object.<string,*>} json JSON definition within `google.protobuf` if a short name, otherwise the file's root definition
 * @returns {undefined}
 * @property {INamespace} google/protobuf/any.proto Any
 * @property {INamespace} google/protobuf/duration.proto Duration
 * @property {INamespace} google/protobuf/empty.proto Empty
 * @property {INamespace} google/protobuf/field_mask.proto FieldMask
 * @property {INamespace} google/protobuf/struct.proto Struct, Value, NullValue and ListValue
 * @property {INamespace} google/protobuf/timestamp.proto Timestamp
 * @property {INamespace} google/protobuf/wrappers.proto Wrappers
 * @example
 * // manually provides descriptor.proto (assumes google/protobuf/ namespace and .proto extension)
 * protobuf.common("descriptor", descriptorJson);
 *
 * // manually provides a custom definition (uses my.foo namespace)
 * protobuf.common("my/foo/bar.proto", myFooBarJson);
 */
function common(name, json) {
	if (!commonRe.test(name)) {
		name = 'google/protobuf/' + name + '.proto'
		json = {
			nested: {
				google: {
					nested: {
						protobuf: {
							nested: json,
						},
					},
				},
			},
		}
	}
	common[name] = json
}

// Not provided because of limited use (feel free to discuss or to provide yourself):
//
// google/protobuf/descriptor.proto
// google/protobuf/source_context.proto
// google/protobuf/type.proto
//
// Stripped and pre-parsed versions of these non-bundled files are instead available as part of
// the repository or package within the google/protobuf directory.

common('any', {
	/**
	 * Properties of a google.protobuf.Any message.
	 * @interface IAny
	 * @type {Object}
	 * @property {string} [typeUrl]
	 * @property {Uint8Array} [bytes]
	 * @memberof common
	 */
	Any: {
		fields: {
			type_url: {
				type: 'string',
				id: 1,
			},
			value: {
				type: 'bytes',
				id: 2,
			},
		},
	},
})
var timeType
common('duration', {
	/**
	 * Properties of a google.protobuf.Duration message.
	 * @interface IDuration
	 * @type {Object}
	 * @property {number|Long} [seconds]
	 * @property {number} [nanos]
	 * @memberof common
	 */
	Duration: (timeType = {
		fields: {
			seconds: {
				type: 'int64',
				id: 1,
			},
			nanos: {
				type: 'int32',
				id: 2,
			},
		},
	}),
})
common('timestamp', {
	/**
	 * Properties of a google.protobuf.Timestamp message.
	 * @interface ITimestamp
	 * @type {Object}
	 * @property {number|Long} [seconds]
	 * @property {number} [nanos]
	 * @memberof common
	 */
	Timestamp: timeType,
})
common('empty', {
	/**
	 * Properties of a google.protobuf.Empty message.
	 * @interface IEmpty
	 * @memberof common
	 */
	Empty: {
		fields: {},
	},
})
common('struct', {
	/**
	 * Properties of a google.protobuf.Struct message.
	 * @interface IStruct
	 * @type {Object}
	 * @property {Object.<string,IValue>} [fields]
	 * @memberof common
	 */
	Struct: {
		fields: {
			fields: {
				keyType: 'string',
				type: 'Value',
				id: 1,
			},
		},
	},
	/**
	 * Properties of a google.protobuf.Value message.
	 * @interface IValue
	 * @type {Object}
	 * @property {string} [kind]
	 * @property {0} [nullValue]
	 * @property {number} [numberValue]
	 * @property {string} [stringValue]
	 * @property {boolean} [boolValue]
	 * @property {IStruct} [structValue]
	 * @property {IListValue} [listValue]
	 * @memberof common
	 */
	Value: {
		oneofs: {
			kind: {
				oneof: ['nullValue', 'numberValue', 'stringValue', 'boolValue', 'structValue', 'listValue'],
			},
		},
		fields: {
			nullValue: {
				type: 'NullValue',
				id: 1,
			},
			numberValue: {
				type: 'double',
				id: 2,
			},
			stringValue: {
				type: 'string',
				id: 3,
			},
			boolValue: {
				type: 'bool',
				id: 4,
			},
			structValue: {
				type: 'Struct',
				id: 5,
			},
			listValue: {
				type: 'ListValue',
				id: 6,
			},
		},
	},
	NullValue: {
		values: {
			NULL_VALUE: 0,
		},
	},
	/**
	 * Properties of a google.protobuf.ListValue message.
	 * @interface IListValue
	 * @type {Object}
	 * @property {Array.<IValue>} [values]
	 * @memberof common
	 */
	ListValue: {
		fields: {
			values: {
				rule: 'repeated',
				type: 'Value',
				id: 1,
			},
		},
	},
})
common('wrappers', {
	/**
	 * Properties of a google.protobuf.DoubleValue message.
	 * @interface IDoubleValue
	 * @type {Object}
	 * @property {number} [value]
	 * @memberof common
	 */
	DoubleValue: {
		fields: {
			value: {
				type: 'double',
				id: 1,
			},
		},
	},
	/**
	 * Properties of a google.protobuf.FloatValue message.
	 * @interface IFloatValue
	 * @type {Object}
	 * @property {number} [value]
	 * @memberof common
	 */
	FloatValue: {
		fields: {
			value: {
				type: 'float',
				id: 1,
			},
		},
	},
	/**
	 * Properties of a google.protobuf.Int64Value message.
	 * @interface IInt64Value
	 * @type {Object}
	 * @property {number|Long} [value]
	 * @memberof common
	 */
	Int64Value: {
		fields: {
			value: {
				type: 'int64',
				id: 1,
			},
		},
	},
	/**
	 * Properties of a google.protobuf.UInt64Value message.
	 * @interface IUInt64Value
	 * @type {Object}
	 * @property {number|Long} [value]
	 * @memberof common
	 */
	UInt64Value: {
		fields: {
			value: {
				type: 'uint64',
				id: 1,
			},
		},
	},
	/**
	 * Properties of a google.protobuf.Int32Value message.
	 * @interface IInt32Value
	 * @type {Object}
	 * @property {number} [value]
	 * @memberof common
	 */
	Int32Value: {
		fields: {
			value: {
				type: 'int32',
				id: 1,
			},
		},
	},
	/**
	 * Properties of a google.protobuf.UInt32Value message.
	 * @interface IUInt32Value
	 * @type {Object}
	 * @property {number} [value]
	 * @memberof common
	 */
	UInt32Value: {
		fields: {
			value: {
				type: 'uint32',
				id: 1,
			},
		},
	},
	/**
	 * Properties of a google.protobuf.BoolValue message.
	 * @interface IBoolValue
	 * @type {Object}
	 * @property {boolean} [value]
	 * @memberof common
	 */
	BoolValue: {
		fields: {
			value: {
				type: 'bool',
				id: 1,
			},
		},
	},
	/**
	 * Properties of a google.protobuf.StringValue message.
	 * @interface IStringValue
	 * @type {Object}
	 * @property {string} [value]
	 * @memberof common
	 */
	StringValue: {
		fields: {
			value: {
				type: 'string',
				id: 1,
			},
		},
	},
	/**
	 * Properties of a google.protobuf.BytesValue message.
	 * @interface IBytesValue
	 * @type {Object}
	 * @property {Uint8Array} [value]
	 * @memberof common
	 */
	BytesValue: {
		fields: {
			value: {
				type: 'bytes',
				id: 1,
			},
		},
	},
})
common('field_mask', {
	/**
	 * Properties of a google.protobuf.FieldMask message.
	 * @interface IDoubleValue
	 * @type {Object}
	 * @property {number} [value]
	 * @memberof common
	 */
	FieldMask: {
		fields: {
			paths: {
				rule: 'repeated',
				type: 'string',
				id: 1,
			},
		},
	},
})

/**
 * Gets the root definition of the specified common proto file.
 *
 * Bundled definitions are:
 * - google/protobuf/any.proto
 * - google/protobuf/duration.proto
 * - google/protobuf/empty.proto
 * - google/protobuf/field_mask.proto
 * - google/protobuf/struct.proto
 * - google/protobuf/timestamp.proto
 * - google/protobuf/wrappers.proto
 *
 * @param {string} file Proto file name
 * @returns {INamespace|null} Root definition or `null` if not defined
 */
common.get = function get(file) {
	return common[file] || null
}

var protobuf = (src.exports = indexLightExports)
protobuf.build = 'full'

// Parser
protobuf.tokenize = tokenize_1
protobuf.parse = parse_1
protobuf.common = common_1

// Configure parser
protobuf.Root._configure(protobuf.Type, protobuf.parse, protobuf.common)
var srcExports = src.exports

var protobufjs = srcExports

function loadProto(str) {
	return protobufjs.parse(str)
}

function o(e, x) {
	return (
		(x.minX >= e.minX && x.minX <= e.maxX && x.minY >= e.minY && x.minY <= e.maxY) ||
		(x.maxX >= e.minX && x.maxX <= e.maxX && x.maxY >= e.minY && x.maxY <= e.maxY) ||
		(x.minX >= e.minX && x.minX <= e.maxX && x.maxY >= e.minY && x.maxY <= e.maxY) ||
		(x.maxX >= e.minX && x.maxX <= e.maxX && x.minY >= e.minY && x.minY <= e.maxY)
	)
}
function s(e) {
	let x = 0
	for (let d = 0; d < e.length; d++) {
		if (null != e.charAt(d).match(/[^\x00-\xff]/gi)) {
			x += 2
		} else {
			x += 1
		}
	}
	return x
}
function h(e, x) {
	let d = e.x,
		t = e.y,
		_ = e.width,
		i = e.height,
		n = x.x,
		a = x.y,
		r = x.width,
		o = x.height
	return !(n <= d && n + r <= d) && !(d <= n && d + _ <= n) && !(a <= t && a + o <= t) && !(t <= a && t + i <= a)
}
const proto = loadProto(
	'option optimize_for = LITE_RUNTIME;package GEOPOI;enum enumGeometryType {ePoint = 0;eMultiLineString = 1;ePolygon = 2;} ;message PBPOI{required uint64 OID = 1;required string Name =2;repeated double Coordinates =3 [packed=true];required enumGeometryType GeometryType = 4;optional int32 Interate = 5;optional int32 SymbolID = 10  [default = 0];optional double DisplayHeight = 11 [default = 32];optional uint32 ShiningColor=12 [default =0];optional uint32\tFontNameIndex=13 [default =0];optional int32\tFontSize=14 [default =18];optional uint32\tFontColor=15 [default =0];};message StringTable {repeated string s = 1;}message PBPOITile{required int64 Version = 1;required int64 TileKey = 2;required StringTable StringTable = 3;repeated PBPOI POIS = 4;};',
).root.lookup('GEOPOI.PBPOITile')
const proto1 = loadProto(
	'option optimize_for = LITE_RUNTIME;package GEOPOI;enum enumGeometryType {ePoint = 0;eMultiLineString = 1;ePolygon = 2;};enum enumZCoordType {eCloseGround = 0;eCloseSeaSurface = 1;eRelativelyGround = 2;eAbsolute = 3;};message PBPOI{required uint64 OID = 1;required string Name =2;repeated double Coordinates =3 [packed=true];required enumGeometryType GeometryType = 4;optional int32 Interate = 5;optional int32 SymbolID = 10  [default = 0];optional double DisplayHeight = 11 [default = 32];optional uint32 ShiningColor=12 [default =0];optional uint32\tFontNameIndex=13 [default =0];optional int32\tFontSize=14 [default =18];optional uint32\tFontColor=15 [default =0];optional enumZCoordType ZCoordType = 16 [default = eAbsolute];};message StringTable {repeated string s = 1;}message PBPOITile{required int64 Version = 1;required int64 TileKey = 2;required StringTable StringTable = 3;repeated PBPOI POIS = 4;};',
).root.lookup('GEOPOI.PBPOITile')
const proto2 = loadProto(
	'option optimize_for = LITE_RUNTIME;package GEOPOI;enum enumGeometryType {ePoint = 0;eMultiLineString = 1;ePolygon = 2;};enum enumZCoordType {eCloseGround = 0;eCloseSeaSurface = 1;eRelativelyGround = 2;eAbsolute = 3;};message PBPOI{required uint64 OID = 1;required string Name =2;repeated double Coordinates =3 [packed=true];required enumGeometryType GeometryType = 4;optional int32 Priority = 5;repeated int32 Interates =6 [packed=true];optional int32 SymbolID = 10  [default = 0];optional double DisplayHeight = 11 [default = 32];optional uint32 ShiningColor=12 [default =0];optional uint32\tFontNameIndex=13 [default =0];optional int32\tFontSize=14 [default =18];optional uint32\tFontColor=15 [default =0];optional enumZCoordType ZCoordType = 16 [default = eAbsolute];optional int32 FontStyle=17;optional int32 ShiningSize=18;};message StringTable {repeated string s = 1;}message PBPOITile{required int64 Version = 1;required int64 TileKey = 2;required StringTable StringTable = 3;repeated PBPOI POIS = 4;};',
).root.lookup('GEOPOI.PBPOITile')
function parseData(data) {
	const d = {
		stringTable: [],
		pois: [],
		enumGeometryType: [
			{
				ePoint: 0,
			},
			{
				eMultiLineString: 1,
			},
			{
				ePolygon: 2,
			},
		],
		enumZCoordType: [
			{
				eCloseGround: 0,
			},
			{
				eCloseSeaSurface: 1,
			},
			{
				eRelativelyGround: 2,
			},
			{
				eAbsolute: 3,
			},
		],
	}
	let i,
		n = new Uint8Array(data)
	try {
		i = proto2.decode(n)
	} catch (e) {
		console.error(e.message)
	}
	if (!i) {
		try {
			i = proto1.decode(n)
		} catch (e) {
			console.error(e.message)
			i = proto.decode(n)
		}
	}
	d.version = parseInt(i.Version.toString())
	d.titleKey = parseInt(i.TileKey.toString())
	for (let a = i.StringTable.s.length, r = 0; r < a; r++) d.stringTable.push(i.StringTable.s[r].toString())
	let len = i.POIS.length
	while (len--) {
		const x = {},
			e = i.POIS[len]
		x.oid = parseInt(e.OID.toString()) + '_' + d.titleKey
		x.name = e.Name.toString()
		x.symbolID = parseInt(e.SymbolID.toString())
		x.displayHeight = e.DisplayHeight
		x.shiningColor = e.ShiningColor
		x.fontNameIndex = e.FontNameIndex
		x.fontSize = e.FontSize
		x.fontColor = e.FontColor
		if (e.ZCoordType) {
			x.zCoordType = e.ZCoordType
		}
		x.geometryType = e.GeometryType
		x.coordinate = e.Coordinates
		x.priority = typeof e.Priority === 'undefined' ? null : e.Priority
		x.interates = typeof e.Interates === 'undefined' ? null : e.Interates
		x.fontStyle = typeof e.FontStyle === 'undefined' ? null : e.FontStyle
		x.shiningSize = typeof e.ShiningSize === 'undefined' ? null : e.ShiningSize
		d.pois.push(x)
	}
	return d
}
const defaultLabelGraphics = {
	font: '28px sans-serif',
	fontSize: 28,
	fillColor: Color.WHITE,
	scale: 0.5,
	outlineColor: Color.BLACK,
	outlineWidth: 5,
	style: LabelStyle.FILL_AND_OUTLINE,
	showBackground: false,
	backgroundColor: Color.RED,
	backgroundPadding: new Cartesian2(10, 10),
	horizontalOrigin: HorizontalOrigin.CENTER,
	verticalOrigin: VerticalOrigin.TOP,
	eyeOffset: Cartesian3.ZERO,
	pixelOffset: new Cartesian2(0, 8),
}
const defaultBillboardGraphics = {
	horizontalOrigin: HorizontalOrigin.CENTER,
	verticalOrigin: VerticalOrigin.CENTER,
	eyeOffset: Cartesian3.ZERO,
	pixelOffset: Cartesian2.ZERO,
	alignedAxis: Cartesian3.ZERO,
	color: Color.WHITE,
	rotation: 0,
	scale: 1,
	width: 18,
	height: 18,
}
class GeoWTFS {
	constructor(viewer, options) {
		if (!defined(viewer)) throw new DeveloperError('viewer is required.')
		if (!defined(options.url)) throw new DeveloperError('options.url is required.')
		options = defaultValue(options, {})
		this.viewer = viewer
		this.proxy = options.proxy
		this.url = options.url
		this.icoUrl = options.icoUrl
		this.metadata = options.metadata
		this.roadMetadata = options.roadMetadata
		this.roadUrl = options.roadUrl
		this.labelGraphics = combine(options.labelGraphics, defaultLabelGraphics, true)
		this.billboardGraphics = combine(options.billboardGraphics, defaultBillboardGraphics, true)
		this.aotuCollide = !!options.aotuCollide
		this.collisionPadding = defaultValue(options.collisionPadding, [3, 5, 3, 5])
		this.serverFirstStyle = !!options.serverFirstStyle
		this.subdomains = options.subdomains || []
		this.tileCache = []
		this.labelCache = []
		this._isInitial = false
		this._latelyGrid = []
		this._latelyRefreshStamp = 0
		this._latelyCollisionStamp = 0
		const guid = createGuid()
		this._UUID = 'GEO_WTFS_LABEL_' + guid
		this._UUIDRoad = 'GEO_WTFS_LABEL_ROAD_' + guid
		this.viewer.camera.percentageChanged = 0.18
		this.bindEvent()
	}
	bindEvent() {
		this.viewer.scene.camera.moveEnd.addEventListener(this._moveEnd, this)
		this.viewer.scene.camera.changed.addEventListener(this._changed, this)
	}
	_moveEnd() {
		clearTimeout(this._timer)
		const surface = this.viewer.scene.globe._surface
		if (surface._tilesToRender.length < 2 || 0 < surface._tileLoadQueueHigh.length) {
			this._timer = setTimeout(() => {
				this._moveEnd()
			}, 100)
		} else {
			const tiles = this.getTilesToRender()
			if (this.compareArray(tiles, this._latelyGrid)) return
			this._queueCall(tiles)
			this.delaySynchronous()
		}
	}
	_changed() {
		const now = new Date().getTime(),
			x = now - this._latelyRefreshStamp,
			d = now - this._latelyCollisionStamp
		if (300 < x) {
			this._moveEnd()
		}
		if (150 < d) {
			this.collisionDetection()
		}
	}
	getTilesToRender() {
		const tiles = this.viewer.scene.globe._surface._tilesToRender
			.map(function (e) {
				return {
					x: e.x,
					y: e.y,
					level: e.level,
					boundBox: {
						minX: Math$1.toDegrees(e.rectangle.west),
						minY: Math$1.toDegrees(e.rectangle.south),
						maxX: Math$1.toDegrees(e.rectangle.east),
						maxY: Math$1.toDegrees(e.rectangle.north),
					},
				}
			})
			.sort(function (a, b) {
				return b.level - a.level
			})
		const x = [tiles[0].level]
		for (let i = 0; i < tiles.length; i++) {
			if (tiles[i].level !== x[x.length - 1]) {
				x.push(tiles[i].level)
				if (4 < x.length) {
					tiles.splice(i, Infinity)
					i--
				}
			}
		}
		return tiles
	}
	compareArray(tiles, latelyGrid) {
		let flag = false
		for (let t = 0; t < tiles.length; t++) {
			let _ = false
			for (let i = 0; i < latelyGrid.length; i++)
				if (
					tiles[t].x === latelyGrid[i].x &&
					tiles[t].y === latelyGrid[i].y &&
					tiles[t].level === latelyGrid[i].level
				) {
					_ = true
					break
				}
			if (!_) {
				flag = true
				break
			}
		}
		return !flag
	}
	_queueCall(tiles) {
		this._latelyGrid = tiles
		this._latelyRefreshStamp = new Date().getTime()
		let len = tiles.length
		while (len--) {
			const tile = tiles[len]
			if (this.metadata && o(this.metadata.boundBox, tile.boundBox)) {
				if (this.metadata.minLevel > tile.level + 1 || this.metadata.maxLevel < tile.level + 1) return
				const cacheTile = this.getCacheTile(tile.x, tile.y, tile.level, 0)
				if (cacheTile) {
					this.addLabelAndIco(cacheTile)
				} else {
					const s = this.subdomains.length ? (tile.x + tile.y) % this.subdomains.length : ''
					let url = this.getTileUrl()
						.replace('{x}', tile.x)
						.replace('{y}', tile.y)
						.replace('{z}', tile.level + 1)
						.replace('{s}', s)
					const xhr = new XMLHttpRequest()
					xhr.open('GET', url, true)
					xhr.responseType = 'arraybuffer'
					const that = this
					xhr.onload = function () {
						if (!(xhr.status < 200 || 300 <= xhr.status)) {
							const res = that.cutString(xhr.response)
							let tileData
							if (res) {
								tileData = parseData(res)
								tileData.x = this.tile.x
								tileData.y = this.tile.y
								tileData.z = this.tile.z
								tileData.t = 0
								that.addCacheTile(tileData)
								that.addLabelAndIco(tileData)
							} else {
								tileData = {
									x: this.tile.x,
									y: this.tile.y,
									z: this.tile.z,
									t: 0,
								}
								that.addCacheTile(tileData)
								that.delaySynchronous()
							}
						}
					}
					xhr.onerror = function (e) {
						console.error(e)
					}
					xhr.send()
					xhr.tile = {
						x: tile.x,
						y: tile.y,
						z: tile.level + 1,
					}
				}
			}
			if (this.roadMetadata && o(this.roadMetadata.boundBox, tile.boundBox)) {
				if (this.roadMetadata.minLevel > tile.level + 1 || this.roadMetadata.maxLevel < tile.level + 1) return
				const cacheTile = this.getCacheTile(tile.x, tile.y, tile.level, 0)
				if (cacheTile) {
					this.addLabelAndIco(cacheTile)
				} else {
					const s = this.subdomains.length ? (tile.x + tile.y) % this.subdomains.length : ''
					const url = this.getRoadTileUrl()
						.replace('{x}', tile.x)
						.replace('{y}', tile.y)
						.replace('{z}', tile.level + 1)
						.replace('{s}', s)
					const xhr = new XMLHttpRequest()
					xhr.open('GET', url, true)
					xhr.responseType = 'json'
					const that = this
					xhr.onload = function () {
						if (!(xhr.status < 200 || 300 <= xhr.status)) {
							const res = xhr.response
							let tileData
							if (res) {
								tileData = {
									pois: res.map(e => {
										return {
											oid: e.LabelPoint.X + '_' + e.LabelPoint.Y,
											name: e.Feature.properties.Name,
											coordinate: [e.LabelPoint.X, e.LabelPoint.Y, e.LabelPoint.Z ? e.LabelPoint.Z : 0],
										}
									}),
									x: this.tile.x,
									y: this.tile.y,
									z: this.tile.z,
									t: 1,
								}
								that.addCacheTile(tileData)
								that.addLabelAndIco(tileData)
							} else {
								tileData = {
									x: this.tile.x,
									y: this.tile.y,
									z: this.tile.z,
									t: 1,
								}
								that.addCacheTile(tileData)
								that.delaySynchronous()
							}
						}
					}
					xhr.onerror = function (e) {
						console.error(e)
					}
					xhr.send()
					xhr.tile = {
						x: tile.x,
						y: tile.y,
						z: tile.level + 1,
					}
				}
			}
		}
	}
	cutString(e) {
		if (!e) return ''
		let x = e.byteLength
		if (x <= 28) {
			return ''
		} else {
			return e.slice(19, x - 9)
		}
	}
	addCacheTile(Tile) {
		if (999 < this.tileCache.length) {
			this.tileCache.splice(0, 500)
		}
		this.removeCacheTile(Tile.x, Tile.y, Tile.z, Tile.t)
		this.tileCache.push(Tile)
	}
	getCacheTile(x, y, z, t) {
		let len = this.tileCache.length
		while (len--) {
			const tileCache = this.tileCache[len]
			if (tileCache.x === x && tileCache.y === y && tileCache.z === z && tileCache.t === t) return tileCache
		}
		return null
	}
	removeCacheTile(x, y, z, t) {
		let i = this.tileCache.length
		while (i--) {
			const cacheTile = this.tileCache[i]
			if (cacheTile.x === x && cacheTile.y === y && cacheTile.z === z && cacheTile.t === t) {
				this.tileCache.splice(i, 1)
				return
			}
		}
	}
	getCacheLabel(id) {
		let i = this.labelCache.length
		while (i--) {
			const cacheLabel = this.labelCache[i]
			if (cacheLabel.name === this._UUID && cacheLabel.oid === id) return cacheLabel
		}
		return null
	}
	addCacheLabel(label) {
		if (999 < this.labelCache.length) {
			this.labelCache.splice(0, 250)
		}
		this.removeCacheLabel(label.oid)
		label.timestamp = new Date().getTime()
		this.labelCache.push(label)
	}
	removeCacheLabel(id) {
		let i = this.labelCache.length
		while (i--) {
			if (this.labelCache[i].name === this._UUID && this.labelCache[i].oid === id) {
				this.labelCache.splice(i, 1)
				return
			}
		}
	}
	HexadecimalConversion(e) {
		if (4278190080 === e) return '#000000'
		let x = 4278190080 | parseInt(-Number(e))
		e = ''
		if ((x = x.toString(16).substring(1)).length < 6) for (let d = 6 - x.length, t = 0; t < d; t++) e += '0'
		return '#' + e + x
	}
	addLabelAndIco(tile) {
		if (tile.pois && tile.pois.length) {
			let i = tile.pois.length
			while (i--) {
				const item = tile.pois[i]
				let label = this.getCacheLabel(item.oid)
				!label && (label = this.createLabel(item, tile))
				this.addCacheLabel(label)
			}
		}
		this.delaySynchronous()
	}
	createLabel(poi, tile) {
		if (poi) {
			const entityOption = {
				show: true,
				position: Cartesian3.fromDegrees(...poi.coordinate),
				label: {
					text: poi.name,
				},
			}
			Object.assign(entityOption.label, this.labelGraphics)
			if (this.serverFirstStyle) {
				if (undefined !== poi.fontSize) {
					entityOption.label.font = poi.fontSize + 'px '
					if (undefined !== poi.fontNameIndex && tile.stringTable && tile.stringTable[poi.fontNameIndex]) {
						entityOption.label.font += tile.stringTable[poi.fontNameIndex]
					} else {
						entityOption.label.font += 'sans-serif'
					}
					if (!this.labelGraphics.bold && (1 !== poi.fontStyle || 3 !== poi.fontStyle)) {
						entityOption.label.font = 'bold ' + entityOption.label.font
					}
					if (2 !== poi.fontStyle || 3 !== poi.fontStyle) {
						entityOption.label.font = 'italic ' + entityOption.label.font
					}
				}
				if (undefined !== poi.fontColor) {
					entityOption.label.fillColor = Color.fromCssColorString(this.HexadecimalConversion(poi.fontColor))
				}
				if (undefined !== poi.shiningColor) {
					entityOption.label.outlineColor = Color.fromCssColorString(this.HexadecimalConversion(poi.shiningColor))
				}
				if (typeof poi.shiningSize === 'number') {
					entityOption.label.outlineWidth = poi.shiningSize
				}
				if (undefined !== poi.showBackground) {
					entityOption.label.showBackground = poi.showBackground
				}
				if (undefined !== poi.backgroundColor) {
					entityOption.label.backgroundColor = poi.backgroundColor
				}
				if (undefined !== poi.backgroundPadding) {
					entityOption.label.backgroundPadding = poi.backgroundPadding
				}
				if (undefined !== poi.eyeOffset) {
					entityOption.label.eyeOffset = poi.eyeOffset
				}
				if (undefined !== poi.pixelOffset) {
					entityOption.label.pixelOffset = poi.pixelOffset
				}
				if (undefined !== poi.style) {
					entityOption.label.style = poi.style
				}
				if (undefined !== poi.scale) {
					entityOption.label.scale = poi.scale
				}
				if (!tile.t) {
					if (undefined !== poi.verticalOrigin) {
						entityOption.label.verticalOrigin = poi.verticalOrigin
					}
					if (undefined !== poi.horizontalOrigin) {
						entityOption.label.horizontalOrigin = poi.horizontalOrigin
					}
				}
			}
			if (undefined !== poi.symbolID && -1 < poi.symbolID) {
				const s = this.subdomains.length ? (tile.x + tile.y) % this.subdomains.length : ''
				entityOption.billboard = {
					image: this.getIcoUrl().replace('{id}', tile.symbolID).replace('{s}', this.subdomains[s]),
				}
				Object.assign(entityOption.billboard, this.billboardGraphics)
				if (this.serverFirstStyle) {
					if (undefined !== poi.displayHeight) {
						entityOption.billboard.width = poi.displayHeight
						entityOption.billboard.height = poi.displayHeight
					}
					if (undefined !== poi.eyeOffset) {
						entityOption.billboard.eyeOffset = poi.eyeOffset
					}
					if (undefined !== poi.pixelOffset) {
						entityOption.billboard.pixelOffset = poi.pixelOffset
					}
					if (undefined !== poi.rotation) {
						// (_['billboard']['rotation'] = e['rotation'])
						entityOption.billboard.rotation = poi.rotation
					}
					if (undefined !== poi.alignedAxis) {
						entityOption.billboard.alignedAxis = poi.alignedAxis
					}
					if (undefined !== poi.color) {
						entityOption.billboard.color = poi.color
					}
					if (undefined !== poi.scale) {
						entityOption.billboard.scale = poi.scale
					}
					if (!tile.t) {
						if (undefined !== poi.verticalOrigin) {
							entityOption.billboard.verticalOrigin = poi.verticalOrigin
						}
						if (undefined !== poi.horizontalOrigin) {
							entityOption.billboard.horizontalOrigin = poi.horizontalOrigin
						}
					}
				}
			}
			if (tile.t) {
				entityOption.label.verticalOrigin = VerticalOrigin.CENTER
				entityOption.label.horizontalOrigin = HorizontalOrigin.CENTER
				entityOption.billboard.verticalOrigin = VerticalOrigin.CENTER
				entityOption.billboard.horizontalOrigin = HorizontalOrigin.CENTER
			}
			const entity = new Entity(entityOption)
			entity.name = tile.x ? this._UUIDRoad : this._UUID
			entity.oid = poi.oid
			entity.priority = poi.priority || 0
			entity.xyz = tile.x + '_' + tile.y + '_' + (tile.z - 1)
			return entity
		}
	}
	getIcoUrl() {
		return (this.proxy ? this.proxy.proxy : '') + this.icoUrl
	}
	getTileUrl() {
		return (this.proxy ? this.proxy.proxy : '') + this.url
	}
	getRoadTileUrl() {
		return (this.proxy ? this.proxy.proxy : '') + this.roadUrl
	}
	delaySynchronous() {
		clearTimeout(this._timer2)
		this._timer2 = setTimeout(() => {
			this.synchronousLabel()
		}, 100)
	}
	synchronousLabel() {
		let i = this.labelCache.length
		while (i--) {
			const label = this.labelCache[i]
			label.timestamp >= this._latelyRefreshStamp &&
				!this.viewer.entities.contains(label) &&
				(this._isInitial && this.aotuCollide && (label.show = false), this.viewer.entities.add(label))
		}
		if (!this._isInitial) {
			let j = this.viewer.entities.values.length
			while (j--) {
				const entity = this.viewer.entities.values[j]
				!entity.name ||
					(entity.name !== this._UUID && entity.name !== this._UUIDRoad) ||
					(entity.timestamp < this._latelyRefreshStamp && (this.viewer.entities.remove(entity), j--))
			}
			if (this.aotuCollide) this.collisionDetection()
		}
	}

	/**
	 * 碰撞检测
	 */
	collisionDetection() {
		const entities = this.viewer.entities.values
		let d = [],
			s = [],
			len = entities.length
		while (len--) {
			const entity = entities[len]
			if (entity.name && (entity.name === this._UUID || entity.name === this._UUIDRoad)) {
				let point, i
				point = SceneTransforms.wgs84ToDrawingBufferCoordinates(this.viewer.scene, entity.position.getValue(0))
				entity.show = true
				i = this.getLabelReact({
					point,
					entity,
				})
				entity.collisionBox = i
				let n = null,
					a = d.length
				while (!n && a--) {
					if (d[a].xyz === entity.xyz) n = d[a]
				}
				if (!n) {
					n = {
						xzy: entity.xyz,
						entities: [],
					}
					d.push(n)
					n.entities.push(entity)
				}
			}
		}
		let dLen = d.length
		while (dLen--) {
			const item = d[dLen]
			item.entities.sort(function (a, b) {
				return a.priority - b.priority
			})
			for (let i = 0; i < item.entities.length; i++) {
				const oItem = item.entities[i]
				if (oItem.show) {
					for (let j = i + 1; j < item.entities.length; j++) {
						if (item.entities[j].show && h(oItem.collisionBox, item.entities[j].collisionBox)) {
							item.entities[j].show = false
						}
					}
					s.push(oItem)
				}
			}
		}
		let m = s.length
		while (m--) {
			if (s[m].show) {
				s.sort(function (a, b) {
					return a.priority - b.priority
				})
				for (let i = m + 1; i < s.length; i++) {
					s[i].show && h(s[m].collisionBox, s[i].collisionBox) && (s[i].show = false)
				}
			}
		}
	}

	/**
	 * 获取label的区域
	 * @param data
	 * @return {{x: number, width: *, y: number, height: *}}
	 */
	getLabelReact(data) {
		const { point, entity } = data
		let fontSize = parseInt(entity.label.font)
		fontSize = 0 < fontSize ? fontSize : 15
		const d = entity.label.text.getValue(0).split('\n')
		let t = 0
		for (let i = 0; i < d.length; i++) {
			let n = s(d[i]) / 2
			if (t < n) t = n
		}
		let a = entity.billboard ? entity.billboard.width.getValue(0) * entity.billboard.scale.getValue(0) : 1
		let r = entity.billboard ? entity.billboard.height.getValue(0) * entity.billboard.scale.getValue(0) : 1
		return {
			x: (point ? point.x : -999) - a / 2 - this.collisionPadding[3],
			y: (point ? point.y : -999) - r / 2 - this.collisionPadding[0],
			width:
				fontSize * entity.label.scale.getValue(0) * t +
				entity.label.pixelOffset.getValue(0).x +
				a +
				this.collisionPadding[1],
			height:
				fontSize * entity.label.scale.getValue(0) * t +
				entity.label.pixelOffset.getValue(0).y +
				a +
				this.collisionPadding[2],
		}
	}
	initTDT(e) {
		let x = 0
		this._isInitial = true
		this._queueCall(e)
		const t = setInterval(() => {
			if (3 < x) {
				this._isInitial = false
				clearInterval(t)
			}
			if (x % 2 === 0 && this.aotuCollide) {
				this.collisionDetection()
			}
			x++
		}, 600)
		return this
	}
	getPropertyValue(e, x, d, t) {
		if (undefined !== x[e]) {
			return x[e]
		} else {
			return undefined !== d[e] ? d[e] : t
		}
	}
	unbindEvent() {
		this.viewer.scene.camera.moveEnd.removeEventListener(this._moveEnd, this)
		this.viewer.scene.camera.changed.removeEventListener(this._changed, this)
	}
	activate() {
		this._latelyGrid = []
		this._moveEnd()
	}
	destroy() {
		let i = this.viewer.entities.values.length
		while (i--) {
			const entity = this.viewer.entities.values[i]
			!entity.name ||
				(entity.name !== this._UUID && entity.name !== this._UUIDRoad) ||
				(this.viewer.entities.remove(entity), i--)
		}
		this.viewer.camera.percentageChanged = 0.5
		this.unbindEvent()
		this.handler = this.handler && this.handler.destroy()
		this.proxy = undefined
		this.viewer = undefined
		this.url = undefined
		this.labelGraphics = undefined
		this.billboardGraphics = undefined
		this.aotuCollide = undefined
		this.collisionPadding = undefined
		this.tileCache = undefined
		this.labelCache = undefined
		this._latelyGrid = undefined
		this._latelyRefreshStamp = undefined
		this._roadTileset = undefined
	}
	getLabelVisibility(Label) {
		if (!Label) return false
		const x = this.viewer.canvas.getBoundingClientRect()
		return !(Label.x < -10 || Label.x > x.right + 10) && !(Label.y < -10 || Label.y > x.bottom + 10)
	}
}

var index = {
	GeoTerrainProvider,
	GeoWTFS,
}

export { index as default }
