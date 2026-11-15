"""Independent normal via Python libm erfc; direct prices and finite-difference Greeks."""
import subprocess,json,math
r=json.loads(subprocess.check_output(['node','tools/dump.mjs'],text=True));n=0;maxprice=0;maxcdf=0
N=lambda x:.5*math.erfc(-x/math.sqrt(2))
def raw(p,side):
 s=p['spot'];k=p['strike'];t=p['days']/365;v=p['volatility'];rr=p['rate'];q=p['yield'];d1=(math.log(s/k)+(rr-q+v*v/2)*t)/(v*math.sqrt(t));d2=d1-v*math.sqrt(t);a=s*math.exp(-q*t);b=k*math.exp(-rr*t)
 return a*N(d1)-b*N(d2) if side=='call' else b*N(-d2)-a*N(-d1)
for x,y in r['cdf']:
 e=abs(y-N(x));maxcdf=max(maxcdf,e);n+=1;assert e<2e-15,(x,y,N(x),e)
for case in r['cases']:
 for side in ['call','put']:
  p=case['input'];ref=raw(p,side);actual=case[side]['price'];maxprice=max(maxprice,abs(ref-actual));n+=1;assert abs(ref-actual)<2e-11,(p,side,ref,actual)
  # Central finite differences in moderate cases avoid ill-conditioned deep-tail subtraction.
  if .7<p['spot']/p['strike']<1.4 and p['volatility']>=.2 and p['days']>=90:
   for key,greek,h,scale in [('spot','delta',p['spot']*1e-4,1),('volatility','vega',1e-4,.01),('days','theta',.01,-1),('rate','rho',1e-4,.01)]:
    left={**p,key:p[key]-h};right={**p,key:p[key]+h};fd=(raw(right,side)-raw(left,side))/(2*h)*scale;v=case[side][greek];n+=1;assert abs(fd-v)<2e-6*max(1,abs(v)),(key,p,fd,v)
   h=p['spot']*.001;fd=(raw({**p,'spot':p['spot']+h},side)-2*ref+raw({**p,'spot':p['spot']-h},side))/(h*h);v=case[side]['gamma'];n+=1;assert abs(fd-v)<2e-5*max(1,abs(v)),('gamma',p,fd,v)
print(f'{n} independent erfc/pricing/finite-difference checks; max CDF absolute {maxcdf:.3g}, price absolute {maxprice:.3g}')
