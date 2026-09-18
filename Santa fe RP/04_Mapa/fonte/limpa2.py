# -*- coding: utf-8 -*-
import re,sys
from collections import deque
X0,Z0,P,CEL,W = -2100,-1875,6,24,164
RAIO=int(sys.argv[1]) if len(sys.argv)>1 else 4
g=[[0]*W for _ in range(W)]
for b,l in enumerate(open("mask.txt",encoding="utf-8").read().strip().split("\n")):
    a=0
    for m in re.finditer(r"([.#o])(\d*)",l):
        c=m.group(1); n=int(m.group(2)) if m.group(2) else 1
        v={".":0,"#":1,"o":2}[c]
        for k in range(a,a+n): g[b][k]=v
        a+=n
rua=[[False]*W for _ in range(W)]
for l in open("vias.txt",encoding="utf-8").read().strip().split("\n"):
    p=l.split(); pts=[tuple(map(int,t.split(","))) for t in p[2:]]
    for k in range(len(pts)-1):
        (i1,j1),(i2,j2)=pts[k],pts[k+1]
        n=max(abs(i2-i1),abs(j2-j1),1)
        for s in range(n+1):
            i=i1+(i2-i1)*s//n; j=j1+(j2-j1)*s//n
            a=int((i+0.5)*P//CEL); b=int((j+0.5)*P//CEL)
            if 0<=a<W and 0<=b<W: rua[b][a]=True
# BFS de distancia a partir das ruas
dist=[[999]*W for _ in range(W)]
q=deque()
for b in range(W):
    for a in range(W):
        if rua[b][a]: dist[b][a]=0; q.append((a,b))
while q:
    a,b=q.popleft()
    for da,db in ((1,0),(-1,0),(0,1),(0,-1)):
        a2,b2=a+da,b+db
        if 0<=a2<W and 0<=b2<W and dist[b2][a2]>dist[b][a]+1:
            dist[b2][a2]=dist[b][a]+1; q.append((a2,b2))
out=[];mant=0;fora=0
for b in range(W):
    s=[];cur=None;n=0
    for a in range(W):
        v=g[b][a]
        if v and dist[b][a]>RAIO: v=0; fora+=1
        elif v: mant+=1
        c={0:".",1:"#",2:"o"}[v]
        if c==cur: n+=1
        else:
            if cur: s.append(cur+str(n))
            cur=c;n=1
    s.append(cur+str(n)); out.append("".join(s))
print("raio",RAIO,"mantidas",mant,"cortadas",fora)
open("mask_limpa.txt","w",encoding="utf-8").write("\n".join(out))
