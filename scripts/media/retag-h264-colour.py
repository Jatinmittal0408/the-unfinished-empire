"""Rewrite the colour description in an MP4's H.264 SPS (avcC) without re-encoding.

    python3 scripts/media/retag-h264-colour.py in.mp4 out.mp4 PRIMARIES TRANSFER MATRIX   (e.g. 1 1 6)
    python3 scripts/media/retag-h264-colour.py --show file.mp4

The SPS is parsed up to the VUI; the video_signal_type section is replaced (or inserted) and every other bit
is copied verbatim. Box sizes up the moov hierarchy and all stco/co64 chunk offsets are adjusted for the
change in length. Fails loudly on anything it does not understand (scaling matrices, in-band SPS).
"""
import struct, sys

class BR:
    def __init__(s, b): s.b = b; s.p = 0
    def u(s, n):
        v = 0
        for _ in range(n): v = (v << 1) | ((s.b[s.p >> 3] >> (7 - (s.p & 7))) & 1); s.p += 1
        return v
    def ue(s):
        z = 0
        while s.u(1) == 0: z += 1
        return (1 << z) - 1 + s.u(z)
    def se(s):
        k = s.ue(); return (k + 1) // 2 if k & 1 else -(k // 2)

def bits_of(b, a, z): r = BR(b); r.p = a; return [r.u(1) for _ in range(z - a)]
def unescape(e):
    o = bytearray(); z = 0
    for x in e:
        if z >= 2 and x == 3: z = 0; continue
        o.append(x); z = z + 1 if x == 0 else 0
    return bytes(o)
def escape(r):
    o = bytearray(); z = 0
    for x in r:
        if z >= 2 and x <= 3: o.append(3); z = 0
        o.append(x); z = z + 1 if x == 0 else 0
    return bytes(o)
def pack(bits):
    while len(bits) % 8: bits.append(0)
    return bytes(int(''.join(map(str, bits[i:i + 8])), 2) for i in range(0, len(bits), 8))

def parse_sps(nal):
    rb = unescape(nal[1:])
    r = BR(rb)
    prof = r.u(8); r.u(8); r.u(8); r.ue()
    if prof in (100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135):
        cf = r.ue()
        if cf == 3: r.u(1)
        r.ue(); r.ue(); r.u(1)
        if r.u(1): raise SystemExit('scaling matrix present: not handled')
    r.ue()
    poc = r.ue()
    if poc == 0: r.ue()
    elif poc == 1:
        r.u(1); r.se(); r.se()
        for _ in range(r.ue()): r.se()
    r.ue(); r.u(1); r.ue(); r.ue()
    if not r.u(1): r.u(1)
    r.u(1)
    if r.u(1): r.ue(); r.ue(); r.ue(); r.ue()
    vui_flag_pos = r.p
    info = {'vui': r.u(1)}
    if not info['vui']: return rb, info, vui_flag_pos, None, None
    if r.u(1):
        if r.u(8) == 255: r.u(16); r.u(16)
    if r.u(1): r.u(1)
    a = r.p                                  # start of video_signal_type_present_flag
    if r.u(1):
        info['video_format'] = r.u(3); info['full_range'] = r.u(1)
        if r.u(1): info['colour'] = (r.u(8), r.u(8), r.u(8))
    b = r.p                                  # end of the video signal type section
    return rb, info, vui_flag_pos, a, b

def rbsp_end(rb):
    # position of the rbsp_stop_one_bit (last 1 bit)
    i = len(rb) - 1
    while rb[i] == 0: i -= 1
    x = rb[i]; k = 0
    while not (x >> k) & 1: k += 1
    return i * 8 + (7 - k)

def new_sps(nal, prim, trc, mtx):
    rb, info, vpos, a, b = parse_sps(nal)
    sig = [1] + [int(c) for c in format(5, '03b')] + [0, 1] + [int(c) for c in format(prim, '08b') + format(trc, '08b') + format(mtx, '08b')]
    end = rbsp_end(rb)
    if info['vui']:
        bits = bits_of(rb, 0, a) + sig + bits_of(rb, b, end)
    else:   # insert a minimal VUI: no aspect, no overscan, signal type, nothing else
        bits = bits_of(rb, 0, vpos) + [1, 0, 0] + sig + [0, 0, 0, 0, 0, 0] + bits_of(rb, vpos + 1, end)
    bits.append(1)
    return bytes([nal[0]]) + escape(pack(bits)), info

def boxes(b, start, end):
    p = start
    while p < end:
        size, typ = struct.unpack('>I4s', b[p:p + 8]); hdr = 8
        if size == 1: size = struct.unpack('>Q', b[p + 8:p + 16])[0]; hdr = 16
        yield p, size, typ.decode('latin1'), hdr
        p += size

def find_path(b, path):
    start, end, chain = 0, len(b), []
    for name in path:
        for p, size, typ, hdr in boxes(b, start, end):
            if typ == name:
                chain.append((p, size, hdr)); start, end = p + hdr, p + size
                if name == 'stsd': start += 8          # version/flags + entry_count
                elif name == 'avc1': start += 78       # visual sample entry fields
                break
        else: raise SystemExit(f'box {name} not found')
    return chain

def main():
    if sys.argv[1] == '--show':
        b = open(sys.argv[2], 'rb').read()
        p, size, hdr = find_path(b, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd', 'avc1', 'avcC'])[-1]
        c = b[p + hdr:p + size]; n = struct.unpack('>H', c[6:8])[0]
        print(parse_sps(c[8:8 + n])[1]); return
    src, dst, prim, trc, mtx = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:6])
    b = bytearray(open(src, 'rb').read())
    chain = find_path(b, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd', 'avc1', 'avcC'])
    p, size, hdr = chain[-1]
    c = b[p + hdr:p + size]
    if c[5] & 0x1f != 1: raise SystemExit('expected exactly one SPS')
    n = struct.unpack('>H', c[6:8])[0]
    old = bytes(c[8:8 + n])
    new, info = new_sps(old, prim, trc, mtx)
    print('SPS before', info, len(old), 'bytes → after', len(new), 'bytes')
    # an in-band SPS in the samples would override avcC: refuse rather than guess
    md = [x for x in boxes(b, 0, len(b)) if x[2] == 'mdat'][0]
    if old in b[md[0]:md[0] + md[1]]: raise SystemExit('SPS also appears in mdat: not handled')
    delta = len(new) - len(old)
    newc = c[:6] + struct.pack('>H', len(new)) + new + c[8 + n:]
    b[p + hdr:p + size] = newc
    for (bp, bs, bh) in chain:                      # grow every ancestor box
        if bh != 8: raise SystemExit('64-bit box size not handled')
        struct.pack_into('>I', b, bp, bs + delta)
    moov_p = chain[0][0]
    mdat = [x for x in boxes(b, 0, len(b)) if x[2] == 'mdat'][0]
    if mdat[0] > moov_p:                            # mdat after moov: chunk offsets move by delta
        stbl_p, stbl_s, stbl_h = chain[4][0], chain[4][1] + delta, chain[4][2]
        for bp, bs, typ, bh in boxes(b, stbl_p + stbl_h, stbl_p + stbl_s):
            if typ in ('stco', 'co64'):
                cnt = struct.unpack('>I', b[bp + 12:bp + 16])[0]
                w, f = (4, '>I') if typ == 'stco' else (8, '>Q')
                for i in range(cnt):
                    o = bp + 16 + i * w; struct.pack_into(f, b, o, struct.unpack(f, b[o:o + w])[0] + delta)
                print('shifted', cnt, typ, 'offsets by', delta)
    # keep the container colr box in step with the bitstream
    i = b.find(b'colrnclx')
    if i > 0: struct.pack_into('>HHH', b, i + 8, prim, trc, mtx)
    open(dst, 'wb').write(b)
    print('SPS now', parse_sps(new)[1])

main()
