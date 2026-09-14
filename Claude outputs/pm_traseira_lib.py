"""
PORTA-MALAS DA FROTA — biblioteca do lado Blender (Santa Fe Roleplay).

RECEITA (confirmada pelo Julio, e a mesma da AMG):
  1. junta TODAS as camadas da traseira num volume so (solidify + VOXEL REMESH) -> acaba com "massa folheada"
  2. corta a tampa na CURVA NATURAL do carro (campo de distancia geodesica alisado, corte exato por
     marching triangles) -> sem escada, sem cortar lanterna no meio
  3. VOXEL REMESH em cada peca (tampa e corpo) -> a aresta do corte arredonda sozinha (o acabamento macio
     da AMG vem daqui, nao de bevel)
  4. boolean tira tudo que sobrou dentro do porta-malas e a CAIXA (cuba) e modelada seguindo a boca

Uso no Blender:
    exec(open(r"D:/T2/Claude outputs/pm_traseira_lib.py").read())
    servidor()                       # ponte HTTP 127.0.0.1:8765 pro Studio
    r = receita_carro("corolla", bpy._pm_in["corolla_chassi"])

Coordenadas: Studio manda rel DriveSeat (x direita, y cima, z tras). Blender = (x, -z, y).
"""
import bpy, bmesh, math, json, threading, heapq
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from http.server import BaseHTTPRequestHandler, HTTPServer

# ============================================================ ponte HTTP
def servidor(porta=8765):
    if getattr(bpy, "_pm_server", None) is not None:
        try: bpy._pm_server.shutdown()
        except Exception: pass
    bpy._pm_in = getattr(bpy, "_pm_in", {}) or {}
    bpy._pm_out = getattr(bpy, "_pm_out", {}) or {}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def _send(self, code, body):
            b = body.encode("utf-8")
            self.send_response(code); self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
        def do_GET(self):
            if self.path == "/ping": return self._send(200, json.dumps({"ok": True, "blender": bpy.app.version_string}))
            if self.path == "/lista": return self._send(200, json.dumps({"in": sorted(bpy._pm_in), "out": sorted(bpy._pm_out)}))
            if self.path.startswith("/out/"):
                t = bpy._pm_out.get(self.path[5:])
                if t is None: return self._send(404, json.dumps({"erro": "sem " + self.path[5:]}))
                return self._send(200, json.dumps(t))
            self._send(404, json.dumps({"erro": "rota"}))
        def do_POST(self):
            if not self.path.startswith("/in/"): return self._send(404, json.dumps({"erro": "rota"}))
            n = self.path[4:]
            ln = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(ln)
            try: bpy._pm_in[n] = json.loads(raw.decode("utf-8"))
            except Exception as e: return self._send(400, json.dumps({"erro": str(e)}))
            self._send(200, json.dumps({"ok": True, "nome": n, "bytes": ln}))

    srv = HTTPServer(("127.0.0.1", porta), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    bpy._pm_server = srv
    return "127.0.0.1:%d" % porta

# ============================================================ basico
def rb2bl(x, y, z): return (x, -z, y)
def bl2rb(v): return (v.x, v.z, -v.y)

def novo_obj(nome, bm):
    for o in list(bpy.data.objects):
        if o.name == nome: bpy.data.objects.remove(o, do_unlink=True)
    me = bpy.data.meshes.new(nome); bm.to_mesh(me)
    ob = bpy.data.objects.new(nome, me); bpy.context.scene.collection.objects.link(ob)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def obj_from_json(nome, tab):
    V = tab["verts"]; F = tab["faces"]
    verts = [rb2bl(V[3*i], V[3*i+1], V[3*i+2]) for i in range(len(V)//3)]
    faces = [(F[3*i], F[3*i+1], F[3*i+2]) for i in range(len(F)//3)]
    for o in list(bpy.data.objects):
        if o.name == nome: bpy.data.objects.remove(o, do_unlink=True)
    me = bpy.data.meshes.new(nome); me.from_pydata(verts, [], faces); me.validate(); me.update()
    ob = bpy.data.objects.new(nome, me); bpy.context.scene.collection.objects.link(ob)
    for k, v in tab.items():
        if k in ("verts", "faces"): continue
        try: ob[k] = v
        except Exception: pass
    return ob

def exportar(ob):
    """malha -> tabela pro Studio (coords rel DS), com normais de canto."""
    me = ob.data.copy()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); me.update()
    M = ob.matrix_world
    verts = []
    for v in me.vertices:
        x, y, z = bl2rb(M @ v.co); verts += [round(x,4), round(y,4), round(z,4)]
    try: me.calc_normals_split()
    except Exception: pass
    faces, nc = [], []
    R = M.to_3x3().inverted_safe().transposed()
    for p in me.polygons:
        for li in p.loop_indices:
            l = me.loops[li]; faces.append(l.vertex_index)
            x, y, z = bl2rb((R @ l.normal).normalized()); nc += [round(x,4), round(y,4), round(z,4)]
    bpy.data.meshes.remove(me)
    return {"verts": verts, "faces": faces, "normaisCanto": nc, "nVerts": len(verts)//3, "nFaces": len(faces)//3}

def bvh_de_varios(objs):
    if not objs: return None
    bm = bmesh.new()
    for o in objs:
        tmp = bmesh.new(); tmp.from_mesh(o.data); tmp.transform(o.matrix_world)
        me = bpy.data.meshes.new("tv"); tmp.to_mesh(me); tmp.free()
        bm.from_mesh(me); bpy.data.meshes.remove(me)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    t = BVHTree.FromBMesh(bm); bm.free(); return t

def bvh_de(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.transform(ob.matrix_world)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    t = BVHTree.FromBMesh(bm); bm.free(); return t

def olhar(cam, alvo):
    cam = Vector(cam); alvo = Vector(alvo); d = alvo - cam
    q = d.normalized().to_track_quat('-Z', 'Y')
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            r = area.spaces.active.region_3d
            r.view_location = alvo; r.view_distance = d.length; r.view_rotation = q; r.view_perspective = 'PERSP'
            sp = area.spaces.active
            sp.shading.type = 'SOLID'; sp.shading.light = 'STUDIO'; sp.shading.color_type = 'OBJECT'
            sp.overlay.show_overlays = False
            area.tag_redraw()

# ============================================================ volume unico (o fim das camadas)
def fundir_volume(objs, nome, voxel=0.045, esp=0.12, suavizar=2, decim=0.0, fechar_y=None):
    """junta as camadas, da espessura (voxel precisa de volume: chapa fina vira farrapo) e VOXEL REMESH.
    Sai UMA superficie fechada — camada, sliver e furo somem por definicao."""
    bm = bmesh.new()
    for ob in objs:
        tmp = bmesh.new(); tmp.from_mesh(ob.data); tmp.transform(ob.matrix_world)
        me = bpy.data.meshes.new("tmp"); tmp.to_mesh(me); tmp.free()
        bm.from_mesh(me); bpy.data.meshes.remove(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.004)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if fechar_y is not None:
        bordas = [e for e in bm.edges if len(e.link_faces) == 1 and all(abs(v.co.y - fechar_y) < 0.3 for v in e.verts)]
        if bordas:
            try: bmesh.ops.holes_fill(bm, edges=bordas, sides=0)
            except Exception: pass
    ob = novo_obj(nome, bm); n0 = len(bm.faces); bm.free()
    s = ob.modifiers.new("esp", "SOLIDIFY"); s.thickness = esp; s.offset = 0.0; s.use_rim = True; s.use_even_offset = False
    m = ob.modifiers.new("remesh", "REMESH"); m.mode = 'VOXEL'; m.voxel_size = voxel; m.adaptivity = 0.0; m.use_smooth_shade = True
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier="esp")
        bpy.ops.object.modifier_apply(modifier="remesh")
        if suavizar:
            sm = ob.modifiers.new("suave", "SMOOTH"); sm.factor = 0.5; sm.iterations = suavizar
            bpy.ops.object.modifier_apply(modifier="suave")
        if decim and decim < 1.0:
            d = ob.modifiers.new("dec", "DECIMATE"); d.ratio = decim
            bpy.ops.object.modifier_apply(modifier="dec")
        try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
        except Exception: bpy.ops.object.shade_smooth()
    return ob, {"antes": n0, "depois": len(ob.data.polygons)}

# ============================================================ casca externa
def _leque(U, n_anel=10, aberturas=(0.0, 20.0, 40.0, 60.0, 78.0)):
    U = Vector(U).normalized()
    a = U.cross(Vector((1,0,0)))
    if a.length < 1e-6: a = U.cross(Vector((0,1,0)))
    a.normalize(); b = U.cross(a).normalized()
    out = []
    for ab in aberturas:
        if ab == 0.0: out.append(U); continue
        r = math.radians(ab)
        for k in range(n_anel):
            th = 2*math.pi*k/n_anel
            out.append((U*math.cos(r) + (a*math.cos(th) + b*math.sin(th))*math.sin(r)).normalized())
    return out

def pele_externa_unica(objs, U, nome, solda=0.02, longe=9.0, tol=0.02, alinha=0.45):
    """so o que aparece DE FORA. O raio parte de FORA (c + d*longe) na direcao -d; partir de dentro
    (o erro que custou 3 voltas) apaga painel rebaixado e retalha o canto."""
    bm = bmesh.new()
    for ob in objs:
        tmp = bmesh.new(); tmp.from_mesh(ob.data); tmp.transform(ob.matrix_world)
        me = bpy.data.meshes.new("tmp"); tmp.to_mesh(me); tmp.free()
        bm.from_mesh(me); bpy.data.meshes.remove(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=solda)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.faces.ensure_lookup_table(); bm.faces.index_update()
    bvh = BVHTree.FromBMesh(bm)
    leque = _leque(U)
    dentro = []
    for f in bm.faces:
        c = f.calc_center_median(); n = f.normal
        visivel = False
        for d in leque:
            if d.dot(n) < alinha: continue
            loc, nn, ii, dist = bvh.ray_cast(c + d*longe, -d, longe*2)
            if loc is not None and (ii == f.index or (loc - c).length < tol): visivel = True; break
        if not visivel: dentro.append(f)
    n_tot = len(bm.faces)
    bmesh.ops.delete(bm, geom=dentro, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = novo_obj(nome, bm); n_fora = len(bm.faces); bm.free()
    return ob, {"faces_totais": n_tot, "externas": n_fora, "internas": len(dentro)}

def limpar_pele(ob, area_min=2e-4, rodadas=3, solda=0.008, area_orelha=0.010, area_ilha=0.05):
    """tira o que vira espinho: face de area ~0, sliver preso por 1 aresta, ilhota solta.
    NAO erodir por contagem de vizinhos: faixa fina legitima (painel da placa) sumia."""
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.transform(ob.matrix_world)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=solda)
    bmesh.ops.dissolve_degenerate(bm, dist=solda*0.5, edges=bm.edges)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    tirou = 0
    for _ in range(rodadas):
        alvo = []
        for f in bm.faces:
            a = f.calc_area()
            if a < area_min: alvo.append(f); continue
            if a < area_orelha and sum(1 for e in f.edges if len(e.link_faces) > 1) <= 1: alvo.append(f)
        if not alvo: break
        tirou += len(alvo); bmesh.ops.delete(bm, geom=alvo, context='FACES')
    bm.faces.ensure_lookup_table()
    visto = set(); fora = []
    for f0 in bm.faces:
        if f0.index in visto: continue
        fila = [f0]; visto.add(f0.index); comp = []
        while fila:
            f = fila.pop(); comp.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in visto: visto.add(g.index); fila.append(g)
        if sum(x.calc_area() for x in comp) < area_ilha: fora.extend(comp)
    if fora: tirou += len(fora); bmesh.ops.delete(bm, geom=fora, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob2 = novo_obj(ob.name, bm); n = len(bm.faces); bm.free()
    return ob2, {"faces": n, "removidas": tirou}

def refinar(ob, alvo=0.10, rodadas=4, nome=None):
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.transform(ob.matrix_world)
    for _ in range(rodadas):
        longas = [e for e in bm.edges if e.calc_length() > alvo]
        if not longas: break
        bmesh.ops.subdivide_edges(bm, edges=longas, cuts=1, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob2 = novo_obj(nome or (ob.name + "_ref"), bm); n = len(bm.faces); bm.free()
    return ob2, n

# ============================================================ corte na curva natural
def dist_geodesica_idx(bm, sementes_idx):
    """Dijkstra POR INDICE (dict com BMVert quebra depois de qualquer op que realoca a malha)."""
    bm.verts.ensure_lookup_table(); bm.verts.index_update()
    INF = 1e18; n = len(bm.verts); d = [INF]*n; fila = []
    for i in sementes_idx:
        d[i] = 0.0; fila.append((0.0, i))
    heapq.heapify(fila)
    while fila:
        dd, i = heapq.heappop(fila)
        if dd > d[i] + 1e-12: continue
        v = bm.verts[i]
        for e in v.link_edges:
            w = e.other_vert(v); j = w.index; nd = dd + e.calc_length()
            if nd < d[j] - 1e-9: d[j] = nd; heapq.heappush(fila, (nd, j))
    return d

def barreiras_idx(bm, perfil, folga_dobr=0.06):
    """barreira = borda aberta + fora da CAIXA validada por foto (Perfis[carro].corte) + perto da lanterna."""
    bm.verts.ensure_lookup_table(); bm.verts.index_update()
    s = set()
    for e in bm.edges:
        if len(e.link_faces) == 1:
            for v in e.verts: s.add(v.index)
    caixa = perfil.get("caixa"); bvh = perfil.get("bvh_luz"); raio = perfil.get("raio_luz", 0.14)
    folga = perfil.get("folga_caixa", 0.0)
    for v in bm.verts:
        p = v.co
        if caixa is not None:
            mn, mx = caixa
            if not (mn.x-folga <= p.x <= mx.x+folga and mn.y-folga <= p.y <= mx.y+folga and mn.z-folga <= p.z <= mx.z+folga):
                s.add(v.index); continue
        else:
            if p.y > perfil["y_dobr"] - folga_dobr or p.z < perfil.get("z_corte", -1e9): s.add(v.index); continue
        if bvh is not None:
            loc, n, i, dd = bvh.find_nearest(p, raio)
            if loc is not None: s.add(v.index)
    return s

def bvh_luzes_grandes(objs, frac=0.35):
    """BVH so das lanternas DE VERDADE. A malha 'LuzesTraseiras' de carro comprado costuma trazer junto
    brake light, luz de placa e refletores espalhados; usar tudo como barreira pinga o campo geodesico
    em dezenas de pontos e o contorno sai serrilhado. Fica so as ilhas grandes."""
    if not objs: return None, []
    bm = bmesh.new()
    for o in objs:
        tmp = bmesh.new(); tmp.from_mesh(o.data); tmp.transform(o.matrix_world)
        me = bpy.data.meshes.new("tl"); tmp.to_mesh(me); tmp.free()
        bm.from_mesh(me); bpy.data.meshes.remove(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.01)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.faces.ensure_lookup_table(); bm.faces.index_update()
    visto = set(); ilhas = []
    for f0 in bm.faces:
        if f0.index in visto: continue
        fila = [f0]; visto.add(f0.index); ilha = []
        while fila:
            f = fila.pop(); ilha.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in visto:
                        visto.add(g.index); fila.append(g)
        ilhas.append((sum(f.calc_area() for f in ilha), ilha))
    if not ilhas: bm.free(); return None, []
    amax = max(a for a, _ in ilhas)
    fica = [ilha for a, ilha in ilhas if a >= frac * amax]
    bm2 = bmesh.new(); mapa = {}
    caixas = []
    for ilha in fica:
        xs = []; zs = []
        for f in ilha:
            vs = []
            for v in f.verts:
                k = (round(v.co.x,4), round(v.co.y,4), round(v.co.z,4))
                if k not in mapa: mapa[k] = bm2.verts.new(v.co)
                vs.append(mapa[k]); xs.append(v.co.x); zs.append(v.co.z)
            try: bm2.faces.new(vs)
            except ValueError: pass
        caixas.append({"x0": min(xs), "x1": max(xs), "z0": min(zs), "z1": max(zs)})
    bm.free()
    t = BVHTree.FromBMesh(bm2); bm2.free()
    return t, caixas

def _sd_retangulo(a, b, amin, amax, bmin, bmax, r):
    """distancia com sinal a um retangulo de cantos arredondados (POSITIVO dentro)."""
    ca = (amin + amax) * 0.5; cb = (bmin + bmax) * 0.5
    ha = max(1e-6, (amax - amin) * 0.5 - r); hb = max(1e-6, (bmax - bmin) * 0.5 - r)
    da = abs(a - ca) - ha; db = abs(b - cb) - hb
    fora = math.hypot(max(da, 0.0), max(db, 0.0))
    dentro = min(max(da, db), 0.0)
    return r - (fora + dentro)

def campo_retangulo(bm, ret):
    """campo do MOLDE da tampa: retangulo arredondado projetado no painel.
    Sem ele o contorno nasce so da distancia geodesica e fica com mordidas e lingua (hatch)."""
    ia, ib = {"x": 0, "y": 1, "z": 2}[ret["eixos"][0]], {"x": 0, "y": 1, "z": 2}[ret["eixos"][1]]
    a0, a1 = ret["min"][0], ret["max"][0]; b0, b1 = ret["min"][1], ret["max"][1]
    r = ret.get("r", 0.35)
    bm.verts.ensure_lookup_table()
    out = [0.0] * len(bm.verts)
    for v in bm.verts:
        out[v.index] = _sd_retangulo(v.co[ia], v.co[ib], a0, a1, b0, b1, r)
    return out

def suavizar_campo(bm, d, iters=45, peso=0.5, travados=None):
    """campo liso = contorno com cara de desenhado."""
    bm.verts.ensure_lookup_table()
    trav = travados or set()
    for _ in range(iters):
        novo = d[:]
        for v in bm.verts:
            i = v.index
            if i in trav: continue
            ns = [d[e.other_vert(v).index] for e in v.link_edges]
            ns = [x for x in ns if x < 1e17]
            if ns: novo[i] = d[i]*(1-peso) + peso*(sum(ns)/len(ns))
        d = novo
    return d

def cortar_por_campo(bm, d, limiar, nome_a="PM_tampa", nome_b="PM_corpo"):
    """CORTE EXATO na curva d = limiar (marching triangles): sem escada, e os dois lados dividem a MESMA curva."""
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    A = bmesh.new(); B = bmesh.new(); mapa = [{}, {}]; alvo = [A, B]
    def vid(k, p):
        ch = (round(p.x,5), round(p.y,5), round(p.z,5))
        v = mapa[k].get(ch)
        if v is None: v = alvo[k].verts.new(p); mapa[k][ch] = v
        return v
    def emitir(k, pts):
        vs = [vid(k, p) for p in pts]
        if len(set(vs)) < 3: return
        try: alvo[k].faces.new(vs)
        except ValueError: pass
    def meio(p, q, dp, dq):
        if abs(dq - dp) < 1e-12: return p.lerp(q, 0.5)
        t = (limiar - dp) / (dq - dp)
        return p.lerp(q, max(0.0, min(1.0, t)))
    nCort = 0
    for f in bm.faces:
        vs = list(f.verts)
        if len(vs) != 3: continue
        P = [v.co.copy() for v in vs]
        D = [1e6 if d[v.index] > 1e17 else d[v.index] for v in vs]
        dentro = [x > limiar for x in D]
        n = sum(dentro)
        if n == 3: emitir(0, P); continue
        if n == 0: emitir(1, P); continue
        nCort += 1
        i0 = dentro.index(True) if n == 1 else dentro.index(False)
        i1, i2 = (i0+1) % 3, (i0+2) % 3
        p0, p1, p2 = P[i0], P[i1], P[i2]
        m01 = meio(p0, p1, D[i0], D[i1]); m02 = meio(p0, p2, D[i0], D[i2])
        k0 = 0 if dentro[i0] else 1; k1 = 1 - k0
        emitir(k0, [p0, m01, m02]); emitir(k1, [m01, p1, p2]); emitir(k1, [m01, p2, m02])
    obA = novo_obj(nome_a, A); obB = novo_obj(nome_b, B)
    nA, nB = len(A.faces), len(B.faces); A.free(); B.free()
    return obA, obB, {"cortados": nCort, "faces_tampa": nA, "faces_corpo": nB}

def mover_ilhas_menores(obA, obB):
    """tampa fica so com a ilha maior; o resto VOLTA pro corpo (se sumir, abre buraco preto)."""
    bmA = bmesh.new(); bmA.from_mesh(obA.data); bmA.transform(obA.matrix_world)
    bmA.faces.ensure_lookup_table()
    visto = set(); ilhas = []
    for f0 in bmA.faces:
        if f0.index in visto: continue
        fila = [f0]; visto.add(f0.index); comp = []
        while fila:
            f = fila.pop(); comp.append(f.index)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in visto: visto.add(g.index); fila.append(g)
        ilhas.append(comp)
    ilhas.sort(key=len, reverse=True)
    if len(ilhas) <= 1:
        bmA.free(); return 0, len(ilhas)
    manter = set(ilhas[0])
    resto = [f for f in bmA.faces if f.index not in manter]
    bmR = bmesh.new(); mapa = {}
    for f in resto:
        vs = []
        for v in f.verts:
            k = (round(v.co.x,5), round(v.co.y,5), round(v.co.z,5))
            if k not in mapa: mapa[k] = bmR.verts.new(v.co)
            vs.append(mapa[k])
        if len(set(vs)) >= 3:
            try: bmR.faces.new(vs)
            except ValueError: pass
    meR = bpy.data.meshes.new("tmpR"); bmR.to_mesh(meR); bmR.free()
    bmB = bmesh.new(); bmB.from_mesh(obB.data); bmB.transform(obB.matrix_world)
    bmB.from_mesh(meR); bpy.data.meshes.remove(meR)
    bmesh.ops.remove_doubles(bmB, verts=bmB.verts, dist=0.0015)
    bmesh.ops.recalc_face_normals(bmB, faces=bmB.faces)
    novo_obj(obB.name, bmB); n_res = len(resto); bmB.free()
    bmesh.ops.delete(bmA, geom=resto, context='FACES')
    bmesh.ops.delete(bmA, geom=[v for v in bmA.verts if not v.link_faces], context='VERTS')
    novo_obj(obA.name, bmA); bmA.free()
    return n_res, len(ilhas)

def suavizar_borda2(ob, bvh_ref, iters=6, fator=0.35):
    """alisa o laco de borda e reprojeta na pele. SO na tampa: no corpo o laco inclui a borda externa
    do recorte e alisar la amassa a traseira inteira."""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    viz = {}
    for e in bm.edges:
        if len(e.link_faces) == 1:
            a, b = e.verts
            viz.setdefault(a, []).append(b); viz.setdefault(b, []).append(a)
    for _ in range(iters):
        novo = {}
        for v, ns in viz.items():
            if not ns: continue
            m = v.co*(1-fator)
            for w in ns: m = m + w.co*(fator/len(ns))
            loc, n, i, dd = bvh_ref.find_nearest(m)
            novo[v] = loc if loc is not None else m
        for v, p in novo.items(): v.co = p
    bmesh.ops.dissolve_degenerate(bm, dist=0.004, edges=bm.edges)
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    return len(viz)

def vidros_dos_furos(obT, nome_base="PM_vidrofuro", area_min=0.5, recuo=0.05, esp=0.05):
    """Todo laco de borda da tampa que NAO e o contorno externo e uma JANELA (Kombi: o vidro traseiro
    dela nao veio no export, entao a tampa ficava com um furo preto dando no porta-malas).
    Cada furo vira uma vidraca fechando o vao, presa na tampa."""
    bm = bmesh.new(); bm.from_mesh(obT.data); bm.transform(obT.matrix_world)
    lacos = lacos_borda(bm)
    feitos = []
    if len(lacos) > 1:
        # o maior (mais pontos) e o contorno externo
        ordenados = sorted(lacos, key=len, reverse=True)
        for k, laco in enumerate(ordenados[1:]):
            pts = [v.co.copy() for v in laco]
            if len(pts) < 6: continue
            cen = Vector((0, 0, 0))
            for q in pts: cen += q
            cen /= len(pts)
            area = 0.0
            for i in range(len(pts)):
                area += ((pts[i] - cen).cross(pts[(i+1) % len(pts)] - cen)).length * 0.5
            if area < area_min: continue
            n = Vector((0, 0, 0))
            for i in range(len(pts)):
                n += (pts[i] - cen).cross(pts[(i+1) % len(pts)] - cen)
            if n.length < 1e-9: continue
            n.normalize()
            if n.dot(cen - Vector((cen.x, cen.y + 1.0, cen.z))) < 0: pass
            bmg = bmesh.new()
            vs = [bmg.verts.new(q - n * recuo) for q in pts]
            vc = bmg.verts.new(cen - n * recuo)
            for i in range(len(vs)):
                try: bmg.faces.new((vs[i], vs[(i+1) % len(vs)], vc))
                except ValueError: pass
            bmesh.ops.recalc_face_normals(bmg, faces=bmg.faces)
            ob = novo_obj("%s_%d" % (nome_base, k), bmg); bmg.free()
            engrossar(ob, esp=esp, bevel=0.01, offset=0.0)
            for pol in ob.data.polygons: pol.use_smooth = False   # leque suave vira estrela de sombra
            ob["pm_pai"] = "tampa"; ob.color = (0.55, 0.72, 0.82, 1)
            feitos.append(ob)
    bm.free()
    return feitos

def costurar_com_original(corpo, bvh_orig, y_rec, faixa=0.9, tampar=True):
    """Funde a borda do CORPO novo na carroceria original no plano do recorte.
    O corpo remodelado so cobre a traseira; o resto do carro continua sendo a malha original. Sem isso
    fica um degrau (o voxel move a superficie ~0.05) e a tampa do volume aparece como friso.
    Faixa de mistura: na costura o vertice cai EXATO na superficie original, e 0.9 pra dentro ja e
    100% voxel. Depois derruba a tampa plana do volume (fica escondida atras da malha original)."""
    bm = bmesh.new(); bm.from_mesh(corpo.data); bm.transform(corpo.matrix_world)
    movidos = 0
    for v in bm.verts:
        dy = y_rec - v.co.y
        if dy < -0.05 or dy > faixa: continue
        t = 1.0 - max(0.0, dy) / faixa
        t = t * t * (3 - 2 * t)
        loc, n, i, d = bvh_orig.find_nearest(v.co, 2.0)
        if loc is None: continue
        v.co = v.co.lerp(loc, t); movidos += 1
    if tampar:
        alvo = [f for f in bm.faces if f.calc_center_median().y > y_rec - 0.03]
        if alvo and len(alvo) < len(bm.faces) * 0.2:
            bmesh.ops.delete(bm, geom=alvo, context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = corpo.data
    corpo.matrix_world = Matrix.Identity(4)
    bm.to_mesh(me); bm.free(); me.update()
    for pol in me.polygons: pol.use_smooth = True
    return movidos

def crescer_borda(ob, bvh_ref, d=0.14, inflar=0.025):
    """A tampa tem que SOBREPOR a boca, como tampa de carro de verdade.
    O voxel arredonda a aresta dos DOIS lados do corte (tampa e corpo), entao sobra uma fresta de
    ~0.1-0.2: nas laterais ela da na parede do corpo, mas na linha da dobradica da direto no
    porta-malas (era isso a 'brecha em cima'). Cresce o laco de borda pra fora, colado na pele,
    e infla a tampa inteira um tiquinho pra ela ficar por CIMA da chapa em vez de coincidir (z-fight)."""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    borda = [v for v in bm.verts if any(len(e.link_faces) == 1 for e in v.link_edges)]
    for v in borda:
        if not v.link_faces: continue
        c = Vector((0, 0, 0))
        for f in v.link_faces: c += f.calc_center_median()
        c /= len(v.link_faces)
        fora = v.co - c
        n = v.normal.copy()
        if n.length > 1e-9:
            fora = fora - n.normalized() * fora.dot(n.normalized())   # so no plano da superficie
        if fora.length < 1e-6: continue
        alvo = v.co + fora.normalized() * d
        loc, nn, ii, dd = bvh_ref.find_nearest(alvo, 2.0)
        v.co = loc if loc is not None else alvo
    bm.normal_update()
    # crescer ponto a ponto serrilha a borda: realisa o laco (colado na pele) depois de crescer
    viz = {}
    for e in bm.edges:
        if len(e.link_faces) == 1:
            a, b = e.verts
            viz.setdefault(a, []).append(b); viz.setdefault(b, []).append(a)
    for _ in range(8):
        novo = {}
        for v, ns in viz.items():
            if not ns: continue
            m = v.co * 0.5
            for w in ns: m = m + w.co * (0.5/len(ns))
            loc, nn, ii, dd = bvh_ref.find_nearest(m, 3.0)
            novo[v] = loc if loc is not None else m
        for v, q in novo.items(): v.co = q
    bm.normal_update()
    if inflar:
        mov = {v: v.normal.copy() * inflar for v in bm.verts}
        for v, m in mov.items(): v.co = v.co + m
    bmesh.ops.dissolve_degenerate(bm, dist=0.004, edges=bm.edges)
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    return len(borda)

def desenhar_tampa2(pele, perfil, folga=0.10, alisa=45):
    bm = bmesh.new(); bm.from_mesh(pele.data); bm.transform(pele.matrix_world)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.verts.index_update(); bm.faces.index_update()
    sem = barreiras_idx(bm, perfil)
    d = dist_geodesica_idx(bm, sem)
    d = suavizar_campo(bm, d, iters=alisa, peso=0.5, travados=sem)
    ret = perfil.get("retangulo")
    if ret:
        sr = campo_retangulo(bm, ret)
        d = [min(d[i] - folga, sr[i]) for i in range(len(d))]
        limiar = 0.0
    else:
        limiar = folga
    obT, obC, info = cortar_por_campo(bm, d, limiar)
    bm.free()
    nomeT, nomeC = obT.name, obC.name
    n_res, n_il = mover_ilhas_menores(obT, obC)
    info["ilhas_tampa"] = n_il; info["devolvidas_ao_corpo"] = n_res
    return bpy.data.objects[nomeT], bpy.data.objects[nomeC], info

# ============================================================ solidos e caixa
def engrossar(ob, esp=0.25, bevel=0.035, seg=2, ang=40, suave=35, offset=-1.0):
    m = ob.modifiers.new("solid", "SOLIDIFY")
    m.thickness = esp; m.offset = offset; m.use_even_offset = False   # even offset EXPLODE em sliver
    m.use_rim = True; m.use_quality_normals = True
    b = ob.modifiers.new("bevel", "BEVEL")
    b.width = bevel; b.segments = seg; b.limit_method = 'ANGLE'; b.angle_limit = math.radians(ang)
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier="solid")
        bpy.ops.object.modifier_apply(modifier="bevel")
        try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(suave))
        except Exception: bpy.ops.object.shade_smooth()
    return ob

def lacos_borda(bm):
    """lacos de borda ORDENADOS. Em vertice com mais de 2 arestas de borda (T que o dissolve cria),
    segue a direcao — antes o caminho parava no meio e o contorno fechava cruzando (cuba em borboleta)."""
    adj = {}
    for e in bm.edges:
        if len(e.link_faces) == 1:
            a, b = e.verts
            adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    visto = set(); out = []
    for v0 in adj:
        if v0 in visto: continue
        laco = [v0]; visto.add(v0); prev = None; cur = v0
        while True:
            viz = [w for w in adj[cur] if w is not prev]
            if not viz: break
            if len(viz) == 1:
                prox = viz[0]
            else:
                d0 = (cur.co - prev.co).normalized() if prev is not None else None
                if d0 is None: prox = viz[0]
                else:
                    prox = max(viz, key=lambda w: (w.co - cur.co).normalized().dot(d0))
            if prox is v0: break            # fechou
            if prox in visto: break
            visto.add(prox); laco.append(prox); prev, cur = cur, prox
        if len(laco) > 2: out.append(laco)
    out.sort(key=len, reverse=True)
    return out

def _reamostra_aro(contorno, passo=0.15, alisa=4):
    Ls = [0.0]
    for i in range(1, len(contorno)+1):
        Ls.append(Ls[-1] + (contorno[i % len(contorno)] - contorno[i-1]).length)
    total = Ls[-1]; n = max(24, int(total/passo))
    aro = []
    for k in range(n):
        s = total*k/n; j = 1
        while j < len(Ls)-1 and Ls[j] < s: j += 1
        a = 0 if Ls[j] == Ls[j-1] else (s - Ls[j-1])/(Ls[j]-Ls[j-1])
        aro.append(contorno[(j-1) % len(contorno)].lerp(contorno[j % len(contorno)], a))
    for _ in range(alisa):
        aro = [aro[i]*0.5 + (aro[(i-1) % n] + aro[(i+1) % n])*0.25 for i in range(n)]
    return aro

_DIRS6 = (Vector((1,0,0)), Vector((-1,0,0)), Vector((0,1,0)), Vector((0,-1,0)), Vector((0,0,1)), Vector((0,0,-1)))

def profundidade_envelope(bvh, p, longe=40.0):
    """Quanto o ponto esta DENTRO do envelope da carroceria (nao dentro da chapa).
    O PM_vol e uma CASCA oca de 0.12 — teste por normal/paridade diz 'fora' pra qualquer ponto no vao
    do porta-malas. Por isso antes eu usava o CASCO CONVEXO, que e mais gordo que o carro onde ele
    afunila (cintura da lanterna, acima do para-choque): a cuba passava do casco e o boolean FURAVA a
    lataria — eram esses os buracos pretos. Aqui: 6 raios nos eixos; so e 'dentro' se TODOS baterem,
    e a profundidade e a menor distancia — isso acompanha a forma concava de verdade."""
    menor = 1e9
    for d in _DIRS6:
        loc, n, i, dd = bvh.ray_cast(p, d, longe)
        if loc is None: return -1e9
        if dd < menor: menor = dd
    return menor

def _dentro_do_volume(bvh, p, margem):
    """(profundidade, ponto na superficie). Negativo = fora."""
    return profundidade_envelope(bvh, p), None

def encaixar_dentro(pontos, cen, bvh, margem=0.12, passos=14, passo=0.06):
    """puxa cada ponto pro centro ate ficar pelo menos `margem` DENTRO do volume do carro.
    Sem isso a cuba atravessa a lataria (visto no BMW: caixa preta saindo pra fora da traseira)."""
    out = []
    for p in pontos:
        q = p.copy()
        for _ in range(passos):
            prof, loc = _dentro_do_volume(bvh, q, margem)
            if prof >= margem: break
            dirc = Vector((cen.x - q.x, cen.y - q.y, 0.0))
            if dirc.length < 1e-6: break
            q = q + dirc.normalized() * passo
        out.append(q)
    return out


def _offset_2d(pts, dist, cen):
    """recua o contorno pela NORMAL local (offset de poligono). Puxar tudo pro centro torce a parede
    onde o contorno e concavo — era isso que fazia os 'V' na cuba."""
    n = len(pts)
    out = []
    for i in range(n):
        a = pts[(i-1) % n]; b = pts[(i+1) % n]
        t = Vector((b.x - a.x, b.y - a.y, 0.0))
        if t.length < 1e-9: out.append(pts[i].copy()); continue
        t.normalize()
        nrm = Vector((-t.y, t.x, 0.0))
        para_centro = Vector((cen.x - pts[i].x, cen.y - pts[i].y, 0.0))
        if nrm.dot(para_centro) < 0: nrm = -nrm
        out.append(pts[i] + nrm * dist)
    # alisa (offset em canto vivo cruza)
    for _ in range(3):
        out = [out[i]*0.6 + (out[(i-1) % n] + out[(i+1) % n])*0.2 for i in range(n)]
    return out

def cuba_do_contorno(contorno, z_piso, nome="PM_cuba", rec_aro=0.05, rec_meio=0.10, queda_meio=0.45, rec_chao=0.28, esp=0.07, bevel=0.04, bvh_vol=None, margem=0.12):
    """a CAIXA do porta-malas, seguindo a boca real. Com bvh_vol, cada anel e empurrado pra dentro
    ate caber na lataria (a cuba nunca vaza pela traseira nem pelas laterais)."""
    if not contorno: return None
    cen = Vector((0,0,0))
    for p in contorno: cen += p
    cen /= len(contorno)
    aro = _reamostra_aro(contorno, passo=0.22); n = len(aro)
    def anel(f_in, dz, z_fix=None):
        out = []
        for p in aro:
            q = p.lerp(Vector((cen.x, cen.y, p.z)), f_in)
            out.append(Vector((q.x, q.y, z_fix if z_fix is not None else p.z + dz)))
        return out
    aro = [Vector((p.x, p.y, p.z - 0.02)) for p in _offset_2d(aro, rec_aro, cen)]
    meio = [Vector((p.x, p.y, p.z - queda_meio)) for p in _offset_2d(aro, rec_meio, cen)]
    chao = [Vector((p.x, p.y, z_piso)) for p in _offset_2d(aro, rec_chao, cen)]
    if bvh_vol is not None:
        meio = encaixar_dentro(meio, cen, bvh_vol, margem)
        chao = encaixar_dentro(chao, cen, bvh_vol, margem)
    bm = bmesh.new()
    va = [bm.verts.new(p) for p in aro]; vm = [bm.verts.new(p) for p in meio]; vc = [bm.verts.new(p) for p in chao]
    for i in range(n):
        j = (i+1) % n
        for a, b in ((va, vm), (vm, vc)):
            try: bm.faces.new((a[i], a[j], b[j], b[i]))
            except ValueError: pass
    try: bm.faces.new(list(reversed(vc)))          # chao como n-gon: o leque pro centro fazia 'barraca'
    except ValueError:
        ce = bm.verts.new(Vector((cen.x, cen.y, z_piso)))
        for i in range(n):
            j = (i+1) % n
            try: bm.faces.new((vc[i], vc[j], ce))
            except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = novo_obj(nome, bm); bm.free()
    m = ob.modifiers.new("solid", "SOLIDIFY"); m.thickness = esp; m.offset = 0.0; m.use_rim = True
    b = ob.modifiers.new("bevel", "BEVEL"); b.width = bevel; b.segments = 2; b.limit_method='ANGLE'; b.angle_limit = math.radians(40)
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier="solid")
        bpy.ops.object.modifier_apply(modifier="bevel")
        try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(20))
        except Exception: bpy.ops.object.shade_flat()
    ob.color = (0.09,0.09,0.10,1)
    return ob




def casco_convexo(ob, nome="PM_casco"):
    """casco convexo do volume: FECHADO e macico, entao 'dentro/fora' funciona.
    Tem que montar um bmesh SO COM OS VERTICES: se as faces originais ficarem no bmesh, o BVH acha a
    casca em vez do casco e o teste de dentro/fora mente (era isso que colapsava a cuba)."""
    M = ob.matrix_world
    bm = bmesh.new()
    for v in ob.data.vertices:
        bm.verts.new(M @ v.co)
    bm.verts.ensure_lookup_table()
    r = bmesh.ops.convex_hull(bm, input=bm.verts[:])
    lixo = r.get("geom_interior", []) + r.get("geom_unused", []) + r.get("geom_holes", [])
    if lixo:
        try: bmesh.ops.delete(bm, geom=lixo, context='VERTS')
        except Exception: pass
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob2 = novo_obj(nome, bm); bm.free()
    ob2.hide_set(True)
    return ob2

def _area_assinada(pts):
    s = 0.0
    n = len(pts)
    for i in range(n):
        a = pts[i]; b = pts[(i+1) % n]
        s += a.x*b.y - b.x*a.y
    return 0.5*s

def _reamostra_n(pts, n):
    """reamostra um laco fechado em n pontos por comprimento de arco (mantem a ORDEM — sampling por
    angulo quebra em contorno tipo banana e a cuba vira borboleta)."""
    m = len(pts)
    L = [0.0]
    for i in range(1, m+1):
        L.append(L[-1] + (pts[i % m] - pts[i-1]).length)
    total = L[-1]
    out = []
    for k in range(n):
        s = total*k/n
        j = 1
        while j < len(L)-1 and L[j] < s: j += 1
        a = 0 if L[j] == L[j-1] else (s - L[j-1])/(L[j]-L[j-1])
        out.append(pts[(j-1) % m].lerp(pts[j % m], a))
    return out

def _alinhar_aneis(a, b, n=72):
    """mesma contagem, mesmo sentido e mesma fase — pronto pra loft sem torcer."""
    A = _reamostra_n(a, n); B = _reamostra_n(b, n)
    if _area_assinada(A) < 0: A = list(reversed(A))
    if _area_assinada(B) < 0: B = list(reversed(B))
    # fase por MENOR SOMA DE DISTANCIAS (casar por angulo erra 180 graus quando os centros nao coincidem
    # e o loft cruza: a cuba saia em borboleta)
    melhor, md = 0, 9e18
    for k in range(n):
        s = 0.0
        for i in range(0, n, 3):
            d = A[i] - B[(i+k) % n]
            s += d.x*d.x + d.y*d.y
        if s < md: md, melhor = s, k
    B = B[melhor:] + B[:melhor]
    return A, B

def _anel_por_angulo(pts, cen, n=72):
    """reamostra um contorno fechado por ANGULO em volta do centro (deixa dois aneis alinhados pra loft)."""
    import math as _m
    saida = []
    m = len(pts)
    for k in range(n):
        th = 2*_m.pi*k/n
        d = Vector((_m.cos(th), _m.sin(th), 0.0))
        melhor = None
        for i in range(m):
            a = pts[i]; b = pts[(i+1) % m]
            ax, ay = a.x - cen.x, a.y - cen.y
            bx, by = b.x - cen.x, b.y - cen.y
            den = (bx - ax)*d.y - (by - ay)*d.x
            if abs(den) < 1e-12: continue
            t = (ax*d.y - ay*d.x) / (-den) if False else ((ax*d.y - ay*d.x) / (den))
            t = -t
            if t < -1e-6 or t > 1+1e-6: continue
            px = ax + (bx-ax)*t; py = ay + (by-ay)*t
            s = px*d.x + py*d.y
            if s <= 0: continue
            if melhor is None or s > melhor[0]:
                melhor = (s, a.lerp(b, max(0.0, min(1.0, t))))
        if melhor: saida.append(melhor[1].copy())
        else: saida.append(pts[k % m].copy())
    return saida

def _retangulo_arredondado(cx, cy, W, D, z, r=0.35, n=72):
    import math as _m
    hx, hz = max(0.05, W/2 - r), max(0.05, D/2 - r)
    base = []
    cantos = [(hx, hz, 0.0), (-hx, hz, _m.pi/2), (-hx, -hz, _m.pi), (hx, -hz, 3*_m.pi/2)]
    seg = max(2, n // 4)
    for (ox, oy, a0) in cantos:
        for i in range(seg):
            a = a0 + (i/seg)*(_m.pi/2)
            base.append(Vector((cx + ox + r*_m.cos(a), cy + oy + r*_m.sin(a), z)))
    return base

def _aneis_cuba(contorno, piso_pos, piso_size, rec_aro=0.05, folga_piso=0.06, n=72, alt_meio=0.55,
                bvh_vol=None, margem=0.10):
    cen = Vector((0,0,0))
    for p in contorno: cen += p
    cen /= len(contorno)
    aro0 = _offset_2d(_reamostra_aro(contorno, passo=0.12), rec_aro, cen)
    px, pz, py = piso_pos[0], piso_pos[1], piso_pos[2]
    W, D = piso_size[0], piso_size[2]
    z_chao = pz + folga_piso
    chao0 = _retangulo_arredondado(px, -py, W, D, z_chao, r=min(0.35, W/4, D/4), n=n)
    aro, chao = _alinhar_aneis(aro0, chao0, n)
    meio = []
    for i in range(n):
        a = aro[i]; c = chao[i]
        p = a.lerp(c, 0.5)
        meio.append(Vector((p.x, p.y, a.z + (c.z - a.z)*alt_meio)))
    cch = Vector((px, -py, z_chao))
    if bvh_vol is not None:
        aro = encaixar_dentro(aro, cen, bvh_vol, margem)
        meio = encaixar_dentro(meio, cch, bvh_vol, margem)
        chao = encaixar_dentro(chao, cch, bvh_vol, margem)
    return aro, meio, chao, cen, cch

def _malha_aneis(aro, meio, chao, nome, fechar_topo=False, subir=0.0):
    n = len(aro)
    bm = bmesh.new()
    va = [bm.verts.new(Vector((p.x, p.y, p.z + subir))) for p in aro]
    vm = [bm.verts.new(p) for p in meio]
    vc = [bm.verts.new(p) for p in chao]
    for i in range(n):
        j = (i+1) % n
        for A, B in ((va, vm), (vm, vc)):
            try: bm.faces.new((A[i], A[j], B[j], B[i]))
            except ValueError: pass
    try: bm.faces.new(list(reversed(vc)))
    except ValueError: pass
    if fechar_topo:
        try: bm.faces.new(va)
        except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = novo_obj(nome, bm); bm.free()
    return ob

def cuba_piso_boca(contorno, piso_pos, piso_size, nome="PM_cuba", rec_aro=0.05, folga_piso=0.06,
                   esp=0.06, bevel=0.035, bvh_vol=None, margem=0.10, n=72, alt_meio=0.55):
    """A CAIXA de verdade: chao = retangulo do PISO (medida validada por foto nos Perfis), boca = o
    contorno real da tampa. Loft alinhado por comprimento de arco e fase por menor distancia."""
    if not contorno: return None
    aro, meio, chao, cen, cch = _aneis_cuba(contorno, piso_pos, piso_size, rec_aro, folga_piso, n, alt_meio, bvh_vol, margem)
    ob = _malha_aneis(aro, meio, chao, nome)
    m = ob.modifiers.new("solid", "SOLIDIFY"); m.thickness = esp; m.offset = 0.0; m.use_rim = True
    b = ob.modifiers.new("bevel", "BEVEL"); b.width = bevel; b.segments = 2; b.limit_method='ANGLE'; b.angle_limit = math.radians(35)
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier="solid")
        bpy.ops.object.modifier_apply(modifier="bevel")
        try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
        except Exception: bpy.ops.object.shade_smooth()
    ob.color = (0.09,0.09,0.10,1)
    return ob

def cavidade_da_cuba(contorno, piso_pos, piso_size, nome="PM_cavidade", bvh_vol=None, margem=0.10, n=72, folga=0.02):
    """cortador booleano = A PROPRIA CUBA fechada e um tico maior. Antes eu usava um prisma que descia
    do contorno ate o fundo: em hatch (tampa = traseira inteira) ele comia o corpo todo."""
    if not contorno: return None
    aro, meio, chao, cen, cch = _aneis_cuba(contorno, piso_pos, piso_size, 0.05 - folga, 0.06 - folga, n, 0.55, bvh_vol, max(0.0, margem - folga))
    ob = _malha_aneis(aro, meio, chao, nome, fechar_topo=True, subir=0.55)
    return ob


def _aneis_caixa_piso(piso_pos, piso_size, z_topo, n=72, alarga=0.06, bvh_vol=None, margem=0.10):
    """aneis de uma caixa reta em cima do PISO (hatch/suv/kombi/fusca: a tampa deles e a traseira toda,
    entao a cuba nao pode seguir a boca — ela e o compartimento embaixo da chapeleira)."""
    px, pz, py = piso_pos[0], piso_pos[1], piso_pos[2]
    W, D = piso_size[0], piso_size[2]
    z_chao = pz + 0.06
    r = min(0.35, W/4, D/4)
    chao = _retangulo_arredondado(px, -py, W, D, z_chao, r=r, n=n)
    aro = _retangulo_arredondado(px, -py, W + alarga*2, D + alarga*2, z_topo, r=r, n=n)
    meio = [Vector((a.x*0.5 + c.x*0.5, a.y*0.5 + c.y*0.5, z_chao + (z_topo - z_chao)*0.5)) for a, c in zip(aro, chao)]
    cch = Vector((px, -py, z_chao))
    if bvh_vol is not None:
        aro = encaixar_dentro(aro, cch, bvh_vol, margem)
        meio = encaixar_dentro(meio, cch, bvh_vol, margem)
        chao = encaixar_dentro(chao, cch, bvh_vol, margem)
    return aro, meio, chao, cch

def cuba_caixa_piso(piso_pos, piso_size, z_topo, nome="PM_cuba", esp=0.06, bevel=0.035, bvh_vol=None, margem=0.10, n=72):
    aro, meio, chao, cch = _aneis_caixa_piso(piso_pos, piso_size, z_topo, n, 0.06, bvh_vol, margem)
    ob = _malha_aneis(aro, meio, chao, nome)
    m = ob.modifiers.new("solid", "SOLIDIFY"); m.thickness = esp; m.offset = 0.0; m.use_rim = True
    b = ob.modifiers.new("bevel", "BEVEL"); b.width = bevel; b.segments = 2; b.limit_method='ANGLE'; b.angle_limit = math.radians(35)
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier="solid")
        bpy.ops.object.modifier_apply(modifier="bevel")
        try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
        except Exception: bpy.ops.object.shade_smooth()
    ob.color = (0.09,0.09,0.10,1)
    return ob

def cavidade_caixa_piso(piso_pos, piso_size, z_topo, nome="PM_cavidade", bvh_vol=None, margem=0.10, n=72):
    aro, meio, chao, cch = _aneis_caixa_piso(piso_pos, piso_size, z_topo, n, 0.04, bvh_vol, max(0.0, margem-0.02))
    return _malha_aneis(aro, meio, chao, nome, fechar_topo=True, subir=0.10)

def prisma_do_contorno(contorno, z_fundo, nome="PM_cavidade", inset=0.0, subir=0.8):
    """cortador booleano: do contorno da boca ate o fundo. Esvazia o porta-malas de vez."""
    if not contorno: return None
    cen = Vector((0,0,0))
    for p in contorno: cen += p
    cen /= len(contorno)
    aro = _reamostra_aro(contorno); n = len(aro)
    topo = []
    for p in aro:
        q = p.lerp(Vector((cen.x, cen.y, p.z)), inset)
        topo.append(Vector((q.x, q.y, p.z + subir)))
    fundo = [Vector((p.x, p.y, z_fundo)) for p in topo]
    bm = bmesh.new()
    vt = [bm.verts.new(p) for p in topo]; vf = [bm.verts.new(p) for p in fundo]
    for i in range(n):
        j = (i+1) % n
        try: bm.faces.new((vt[i], vt[j], vf[j], vf[i]))
        except ValueError: pass
    ct = bm.verts.new(Vector((cen.x, cen.y, max(p.z for p in topo) + 0.05)))
    cf = bm.verts.new(Vector((cen.x, cen.y, z_fundo)))
    for i in range(n):
        j = (i+1) % n
        try: bm.faces.new((vt[i], vt[j], ct))
        except ValueError: pass
        try: bm.faces.new((vf[j], vf[i], cf))
        except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = novo_obj(nome, bm); bm.free()
    return ob

def abrir_cavidade(corpo, prisma):
    m = corpo.modifiers.new("cav", "BOOLEAN"); m.operation = 'DIFFERENCE'; m.object = prisma
    try: m.solver = 'EXACT'
    except Exception: pass
    n0 = len(corpo.data.polygons)
    with bpy.context.temp_override(object=corpo, active_object=corpo, selected_objects=[corpo], selected_editable_objects=[corpo]):
        bpy.ops.object.modifier_apply(modifier="cav")
    return {"antes": n0, "depois": len(corpo.data.polygons)}

def limpar_soltos(ob, area_min=0.30):
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.faces.ensure_lookup_table()
    visto = set(); fora = []; n_il = 0
    for f0 in bm.faces:
        if f0.index in visto: continue
        fila = [f0]; visto.add(f0.index); comp = []
        while fila:
            f = fila.pop(); comp.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in visto: visto.add(g.index); fila.append(g)
        n_il += 1
        if sum(x.calc_area() for x in comp) < area_min: fora.extend(comp)
    if fora: bmesh.ops.delete(bm, geom=fora, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    for p in ob.data.polygons: p.use_smooth = True
    return {"ilhas": n_il, "removidas": len(fora)}

# ============================================================ receita por carro

def decimar_para(ob, alvo):
    """reduz a malha ate ~alvo triangulos (o Roblox aceita no maximo 20k por MeshPart)."""
    n = len(ob.data.polygons)
    if n <= alvo: return n
    d = ob.modifiers.new("dec2", "DECIMATE"); d.ratio = max(0.02, alvo / float(n))
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier="dec2")
        try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
        except Exception: bpy.ops.object.shade_smooth()
    return len(ob.data.polygons)

def rb_box(corte):
    mn, mx = corte["min"], corte["max"]
    return (Vector((mn[0], -mx[2], mn[1])), Vector((mx[0], -mn[2], mx[1])))

NOMES_LUZ = ("luz", "lanterna", "tail", "lampad", "farol")

def receita_carro(chave, tab, voxel_corpo=0.045, voxel_tampa=0.04, folga=0.10, alisa=45, raio_luz=0.14, esp_tampa=0.20,
                  alvo_tampa=4500, alvo_corpo=12000, alvo_cuba=3000, alvo_lanterna=1800,
                  sobrepor=0.14, inflar=0.025, margem_cuba=0.10, costurar=True, saliencia=0.02):
    for o in list(bpy.data.objects):
        if o.name.startswith("PM_"): bpy.data.objects.remove(o, do_unlink=True)
    camadas, luzes, vidros = [], [], []
    for k, t in bpy._pm_in.items():
        if not k.startswith(chave + "_full_"): continue
        nome = k[len(chave + "_full_"):]
        ob = obj_from_json("PM_" + nome, t)
        orig = (t.get("origem") or "").lower(); mat = t.get("material") or ""; tr = t.get("transparencia") or 0
        if mat == "Neon" or any(w in orig for w in NOMES_LUZ) or any(w in nome.lower() for w in NOMES_LUZ):
            luzes.append(ob)
        elif tr > 0.15 or mat == "Glass":
            vidros.append(ob)
        else:
            camadas.append(ob)
    if not camadas: return {"erro": "sem camadas de carroceria"}
    caixa = rb_box(tab["corte"])
    _pp = tab["piso"]["pos"]; _ps = tab["piso"]["size"]
    # o recorte tem que cobrir TODO o piso do porta-malas: se parar antes, a cuba fica com a frente
    # fora do volume, o encaixe empurra tudo pro centro e o loft torce (cuba em borboleta)
    y_rec = max(caixa[1].y + 1.15, -_pp[2] + _ps[2]/2.0 + 0.45)
    def recorta(ob):
        bm = bmesh.new(); bm.from_mesh(ob.data); bm.transform(ob.matrix_world)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector((0, y_rec, 0)), plane_no=Vector((0,1,0)), clear_outer=True, clear_inner=False)
        o2 = novo_obj(ob.name + "_r", bm); bm.free(); return o2
    cam_r = [o for o in (recorta(x) for x in camadas) if len(o.data.polygons) > 0]
    luz_r = [o for o in (recorta(x) for x in luzes) if len(o.data.polygons) > 0]
    if not cam_r: return {"erro": "nada na traseira depois do recorte"}
    bvh_luz, caixas_luz = bvh_luzes_grandes(luz_r, frac=0.35)
    vid_r = [o for o in (recorta(x) for x in vidros) if len(o.data.polygons) > 0]
    # hatch/suv/kombi: a JANELA faz parte da tampa. Se o vidro nao entrar no volume, ela vira um furo,
    # o furo vira barreira e a tampa nunca sobe alem do vidro (sai uma placa retangular no meio da porta).
    porta_inteira = tab.get("classe") in ("hatch", "suv", "kombi")
    # LANTERNA NAO ENTRA NO VOLUME. Se entrar, o voxel do corpo nasce POR CIMA dela e a lanterna
    # some (so sobram cacos vermelhos nos cantos). Fora da fusao, o corpo fica com o rebaixo dela e
    # a peca original senta no lugar certo — e so precisa de 0.02 de saliencia.
    fundir = cam_r + (vid_r if porta_inteira else [])
    vol, iv = fundir_volume(fundir, "PM_vol", voxel=voxel_corpo, esp=0.12, suavizar=2, decim=0.30, fechar_y=y_rec)
    pele, ip = pele_externa_unica([vol], (0,-0.4,1.0), "PM_pele", solda=0.004, alinha=0.35)
    pele, il = limpar_pele(pele, area_min=1e-5, rodadas=2, area_orelha=0.004, area_ilha=0.08)
    d = tab["dobradica"]["pos"]; piso = tab["piso"]["pos"]
    perfil = {"caixa": caixa, "bvh_luz": bvh_luz, "raio_luz": raio_luz,
              "xc": d[0], "y_dobr": -d[2], "z_dobr": d[1], "z_piso": piso[1], "classe": tab.get("classe")}
    # MOLDE da tampa (hatch/suv/kombi): a tampa traseira e um retangulo arredondado entre as lanternas,
    # do pe da lanterna pra cima. Sem molde a curva geodesica sozinha da mordida na lanterna e lingua
    # no para-choque. Sedan/picape/fusca continuam so na geodesica (ja estavam bons).
    if tab.get("classe") in ("hatch", "suv", "kombi"):
        xc = d[0]; x0, x1 = caixa[0].x, caixa[1].x; zb = caixa[0].z
        lat = [c for c in caixas_luz if (c["x1"] - c["x0"]) < (caixa[1].x - caixa[0].x) * 0.75]
        esq = [c for c in lat if (c["x0"] + c["x1"]) * 0.5 < xc]
        dirr = [c for c in lat if (c["x0"] + c["x1"]) * 0.5 >= xc]
        if esq: x0 = max(x0, max(c["x1"] for c in esq) + 0.06)
        if dirr: x1 = min(x1, min(c["x0"] for c in dirr) - 0.06)
        if lat: zb = max(zb, min(c["z0"] for c in lat) - 0.04)
        if x1 - x0 < 1.4: x0, x1 = caixa[0].x, caixa[1].x
        perfil["retangulo"] = {"eixos": ("x", "z"), "min": (x0, zb), "max": (x1, caixa[1].z), "r": 0.35}
    obT, obC, ic = desenhar_tampa2(pele, perfil, folga=folga, alisa=alisa)
    if ic["faces_tampa"] == 0: return {"erro": "tampa vazia", "corte": ic}
    bmr = bmesh.new(); bmr.from_mesh(pele.data); bmr.transform(pele.matrix_world)
    bmesh.ops.triangulate(bmr, faces=bmr.faces); ref = BVHTree.FromBMesh(bmr); bmr.free()
    suavizar_borda2(obT, ref, iters=6, fator=0.35)
    bm = bmesh.new(); bm.from_mesh(obT.data); bm.transform(obT.matrix_world)
    lacos = lacos_borda(bm); contorno = [v.co.copy() for v in lacos[0]] if lacos else []
    bm.free()
    # o contorno acima e a BOCA (linha do corte). So depois disso a tampa cresce pra sobrepor.
    vidros_furo = vidros_dos_furos(obT)
    crescer_borda(obT, ref, d=sobrepor, inflar=inflar)
    bvh_vol = bvh_de(vol)   # envelope REAL (6 raios), nao mais o casco convexo — ver profundidade_envelope
    tampa, iT = fundir_volume([obT], "PM_tampa", voxel=voxel_tampa, esp=esp_tampa, suavizar=2, decim=0.35)
    corpo, iC = fundir_volume([bpy.data.objects["PM_corpo"]], "PM_corpo", voxel=voxel_corpo, esp=0.14, suavizar=1, decim=0.30)
    # picape nao leva cuba: a caçamba JA e o compartimento (decisao do Julio) — e o cortador dela comeria
    # o corpo inteiro, porque o "piso" da picape e o chao da caçamba
    classe = tab.get("classe")
    eh_picape = (classe == "picape")
    # sedan/230i: a cuba vai da BOCA ate o piso. hatch/suv/kombi/fusca: a tampa e a traseira inteira,
    # entao a cuba e uma caixa reta em cima do piso (senao o cortador leva o corpo junto).
    caixa_reta = classe in ("hatch", "suv", "kombi", "fusca")
    icav, isol, cuba = {}, {}, None
    if not eh_picape:
        z_topo = d[1] - 0.30
        # hatch/suv/kombi/fusca: a dobradica fica no TETO, entao z_topo pela dobradica faz uma caixa de
        # 3.8 studs que come a traseira inteira no boolean. O compartimento tem altura propria.
        ALT_CAIXA = {"hatch": 1.70, "suv": 1.90, "kombi": 1.60, "fusca": 1.20}
        if caixa_reta and classe in ALT_CAIXA:
            z_topo = min(z_topo, piso[1] + ALT_CAIXA[classe])
        if caixa_reta:
            pr = cavidade_caixa_piso(piso, tab["piso"]["size"], z_topo, "PM_cavidade", bvh_vol=bvh_vol, margem=margem_cuba)
        else:
            pr = cavidade_da_cuba(contorno, piso, tab["piso"]["size"], "PM_cavidade", bvh_vol=bvh_vol, margem=margem_cuba)
        icav = abrir_cavidade(corpo, pr) if pr else {}
        isol = limpar_soltos(corpo, area_min=0.30)
        if pr: bpy.data.objects.remove(pr, do_unlink=True)
        if caixa_reta:
            cuba = cuba_caixa_piso(piso, tab["piso"]["size"], z_topo, "PM_cuba", bvh_vol=bvh_vol, margem=margem_cuba)
        else:
            cuba = cuba_piso_boca(contorno, piso, tab["piso"]["size"], "PM_cuba", bvh_vol=bvh_vol, margem=margem_cuba)
    else:
        isol = limpar_soltos(corpo, area_min=0.30)
    if costurar:
        bvh_orig = bvh_de_varios(camadas + luzes)
        if bvh_orig is not None:
            costurar_com_original(corpo, bvh_orig, y_rec, faixa=0.9)
    decimar_para(tampa, alvo_tampa); decimar_para(corpo, alvo_corpo)
    if cuba: decimar_para(cuba, alvo_cuba)
    lant = []
    for i, o in enumerate(luz_r):
        cp = o.copy(); cp.data = o.data.copy(); cp.name = "PM_lanterna_%d" % i
        bpy.context.scene.collection.objects.link(cp)
        bmc = bmesh.new(); bmc.from_mesh(cp.data)
        bmesh.ops.remove_doubles(bmc, verts=bmc.verts, dist=0.01); bmesh.ops.recalc_face_normals(bmc, faces=bmc.faces)
        bmc.to_mesh(cp.data); bmc.free()
        engrossar(cp, esp=0.09, bevel=0.02, offset=-1.0)
        decimar_para(cp, alvo_lanterna)
        # A lanterna entra no volume fundido, entao o corpo novo nasce POR CIMA dela e ela SOME
        # (medido: mediana so 0.02 pra fora, com pontos ate 0.11 pra dentro; inflar pela normal do
        # vertice quase nao move, as normais da casca fina se cancelam). O que funciona e empurrar
        # CADA vertice ate ficar `saliencia` fora da superficie do corpo, medindo contra o corpo.
        # NAO projetar vertice a vertice: casca externa e interna caem no MESMO offset e a lanterna
        # vira um filme de area zero (medido: sobrava so uns cacos vermelhos). Translada a peca
        # INTEIRA pela normal media, o tanto que o ponto mais enterrado precisa.
        bvhCp = bvh_de(corpo)
        nm = Vector((0, 0, 0)); pior = -9.9
        for pol in cp.data.polygons:
            nm += pol.normal * pol.area
            pc = cp.matrix_world @ pol.center
            loc, nn, ii, dd = bvhCp.find_nearest(pc, 2.0)
            if loc is not None:
                pior = max(pior, -(pc - loc).dot(nn))
        if nm.length > 1e-9 and pior > -9.0:
            passo = min(0.45, max(0.0, pior) + saliencia)
            cp.matrix_world = Matrix.Translation(nm.normalized() * passo) @ cp.matrix_world
        cp.color = (0.72,0.05,0.05,1); lant.append(cp)
    # VIDRO: no hatch a janela da tampa vira um FURO se o vidro nao existir. Recorta o vidro original,
    # da uma espessura fina e decide se ele anda com a tampa (perto dela) ou fica no corpo.
    vid = []
    if vid_r:
        bvhT = bvh_de(tampa)
        bmv = bmesh.new()
        for r in vid_r:
            tmp = bmesh.new(); tmp.from_mesh(r.data); tmp.transform(r.matrix_world)
            me = bpy.data.meshes.new("tv"); tmp.to_mesh(me); tmp.free()
            bmv.from_mesh(me); bpy.data.meshes.remove(me)
            bpy.data.objects.remove(r, do_unlink=True)
        bmesh.ops.remove_doubles(bmv, verts=bmv.verts, dist=0.01)
        bmesh.ops.recalc_face_normals(bmv, faces=bmv.faces)
        bmv.faces.ensure_lookup_table()
        # UMA malha de vidro cobre janela lateral E tampa: classificar pelo centroide da malha inteira
        # manda tudo pro lado errado. Separa em ilhas e decide ilha por ilha.
        visto = set(); grupos = {"tampa": [], "corpo": []}
        for f0 in bmv.faces:
            if f0.index in visto: continue
            fila = [f0]; visto.add(f0.index); ilha = []
            while fila:
                f = fila.pop(); ilha.append(f)
                for e in f.edges:
                    for g in e.link_faces:
                        if g.index not in visto:
                            visto.add(g.index); fila.append(g)
            cen = Vector((0,0,0)); ar = 0.0
            for f in ilha:
                a = f.calc_area(); cen += f.calc_center_median() * a; ar += a
            if ar < 1e-6: continue
            cen /= ar
            loc, nn, ii, dd = bvhT.find_nearest(cen, 4.0)
            grupos["tampa" if (loc is not None and dd < 0.40) else "corpo"].append(ilha)
        for pai, ilhas in grupos.items():
            # so o vidro DA TAMPA vira peca. O vidro do corpo e a janela lateral/traseira original,
            # que continua no carro — recriar aqui poe uma chapa de vidro atravessada na boca.
            if pai != "tampa" or not ilhas: continue
            bmg = bmesh.new()
            mapa = {}
            for ilha in ilhas:
                for f in ilha:
                    vs = []
                    for v in f.verts:
                        k = (round(v.co.x,4), round(v.co.y,4), round(v.co.z,4))
                        if k not in mapa: mapa[k] = bmg.verts.new(v.co)
                        vs.append(mapa[k])
                    try: bmg.faces.new(vs)
                    except ValueError: pass
            bmesh.ops.recalc_face_normals(bmg, faces=bmg.faces)
            o = novo_obj("PM_vidro_%d" % len(vid), bmg); bmg.free()
            engrossar(o, esp=0.05, bevel=0.012, offset=-1.0)
            decimar_para(o, 1500)
            if porta_inteira:
                o.matrix_world = Matrix.Translation(Vector((0, -0.4, 1.0)).normalized() * 0.035) @ o.matrix_world
            o["pm_pai"] = pai; o.color = (0.55,0.72,0.82,1); vid.append(o)
        bmv.free()
    for o in vidros_furo:
        o.name = "PM_vidro_%d" % len(vid); vid.append(o)
    tampa.color = (0.62,0.76,0.95,1); corpo.color = (0.85,0.85,0.8,1)
    if contorno:
        if tab.get("classe") == "picape":
            zmin = min(p.z for p in contorno); sel = [p for p in contorno if p.z < zmin + 0.12]
        else:
            ymax = max(p.y for p in contorno); sel = [p for p in contorno if p.y > ymax - 0.12]
        dobr = Vector((sum(p.x for p in sel)/len(sel), sum(p.y for p in sel)/len(sel), sum(p.z for p in sel)/len(sel)))
    else:
        dobr = Vector((d[0], -d[2], d[1]))
    bpy._pm_ultimo = {"chave": chave, "contorno": contorno, "dobradica": dobr, "perfil": perfil,
                      "vidros": [(o.name, o["pm_pai"]) for o in vid]}
    return {"camadas": len(cam_r), "luzes": len(luz_r), "vidros": len(vidros), "volume": iv, "pele": ip,
            "corte": ic, "cavidade": icav, "soltos": isol, "contorno": len(contorno),
            "dobradica": [round(x,3) for x in dobr],
            "faces": {"tampa": len(tampa.data.polygons), "corpo": len(corpo.data.polygons),
                      "cuba": len(cuba.data.polygons) if cuba else 0,
                      "lanternas": sum(len(o.data.polygons) for o in lant),
                      "vidros": [(o.name, o["pm_pai"], len(o.data.polygons)) for o in vid]}}

def _pecas_da_tampa():
    u = getattr(bpy, "_pm_ultimo", None) or {}
    nomes = ["PM_tampa"] + [n for n, pai in (u.get("vidros") or []) if pai == "tampa"]
    return [bpy.data.objects[n] for n in nomes if n in bpy.data.objects]

def abrir_tampa(ang=-70):
    u = getattr(bpy, "_pm_ultimo", None)
    if not u: return None
    p = u["dobradica"]; obs = _pecas_da_tampa()
    if not obs: return None
    M = Matrix.Translation(p) @ Matrix.Rotation(math.radians(ang), 4, 'X') @ Matrix.Translation(-p)
    for t in obs: t.matrix_world = M
    return [round(x,2) for x in p]

def fechar_tampa():
    for t in _pecas_da_tampa(): t.matrix_world = Matrix.Identity(4)

def so_pecas():
    for o in bpy.data.objects:
        o.hide_set(not (o.name in ("PM_tampa","PM_corpo","PM_cuba")
                        or o.name.startswith("PM_lanterna") or o.name.startswith("PM_vidro")))

def exportar_pecas(chave):
    """poe tampa/corpo/cuba/lanternas em bpy._pm_out pro Studio buscar."""
    bpy._pm_out = getattr(bpy, "_pm_out", {}) or {}
    saida = {}
    for nome in ("PM_tampa", "PM_corpo", "PM_cuba"):
        ob = bpy.data.objects.get(nome)
        if ob:
            k = chave + "_" + nome[3:]
            bpy._pm_out[k] = exportar(ob); saida[k] = bpy._pm_out[k]["nFaces"]
    i = 0
    while True:
        ob = bpy.data.objects.get("PM_lanterna_%d" % i)
        if not ob: break
        k = "%s_lanterna%d" % (chave, i)
        bpy._pm_out[k] = exportar(ob); saida[k] = bpy._pm_out[k]["nFaces"]; i += 1
    i = 0
    while True:
        ob = bpy.data.objects.get("PM_vidro_%d" % i)
        if not ob: break
        k = "%s_vidro%d" % (chave, i)
        bpy._pm_out[k] = exportar(ob); bpy._pm_out[k]["pai"] = ob.get("pm_pai", "corpo")
        saida[k] = bpy._pm_out[k]["nFaces"]; i += 1
    u = getattr(bpy, "_pm_ultimo", None)
    if u:
        p = u["dobradica"]
        bpy._pm_out[chave + "_meta"] = {"dobradica": bl2rb(p), "contorno": [bl2rb(q) for q in u["contorno"]],
                                        "vidros": [{"nome": n, "pai": pai} for n, pai in (u.get("vidros") or [])]}
        saida[chave + "_meta"] = 1
    return saida

_LIB = {k: v for k, v in list(globals().items()) if callable(v) and not k.startswith("__")}
bpy._pm_lib = _LIB
print("pm_traseira_lib carregada:", len(_LIB), "funcoes")
