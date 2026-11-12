(function(){
const day=864e5, seed={BTC:1.6e9,ETH:5.8e7,SOL:2.4e6,XRP:3.9e4,DOGE:3.2e3,BNB:1e7};
function ohlc(sym,start){const n=Math.max(2,Math.round((Date.now()-new Date(start))/day));let p=seed[sym]||1e5;const a=[];for(let i=0;i<n;i++){const o=p;p=p*(1+Math.sin(i*1.3+sym.length)*0.02+0.002);a.push({st:new Date(Date.now()-(n-i)*day).toISOString(),o,h:Math.max(o,p)*1.01,l:Math.min(o,p)*0.99,c:p});}return a;}
function pay(tool,inp){
 if(tool==="generate_new_session_id")return{data:{chatSessionId:"mock"}};
 if(tool==="crypto_get_price")return{data:inp.symbols.map(s=>({symbol:s,midPrice:(seed[s]||1e5)*1.08}))};
 if(tool==="crypto_get_ohlc")return{data:ohlc(inp.symbol,inp.start)};
 if(tool==="us_stocks_get_price")return{marketStatus:{isMarketOpen:true},data:inp.symbols.map((s,i)=>({symbol:s,midPrice:150+i*40,prevClosePrice:148+i*41,lowPrice:146+i*40,highPrice:153+i*40}))};
 if(tool==="indo_stocks_get_price")return{data:inp.symbols.map((s,i)=>({symbol:s,lastPrice:4000+i*1150,prevClosePrice:3980+i*1170,stats:{turnover:"1,2T"}}))};
 if(tool==="portfolio_get_buying_power")return{usdToIdrRate:16350};
 if(tool==="portfolio_get_wallet_balance")return{data:{totals:{IDR:{amount:2500000},USD:{amount:120.5}}}};
 if(tool==="portfolio_get_holdings"){const it=(sym,name,q,v,c,pnl)=>({tileInfo:{displaySymbol:sym,name},display:{valueAndProfit:{totalQuantity:q,meta:{value:v,currency:c,profitValue:pnl,profitValuePercentage:pnl/v*100}}}});
  return{data:{reportedTotals:{netAssetValueIdr:48000000,unrealisedPnlIdr:3100000},assetCategories:[
  {assetCategory:"cryptocurrency",title:"Crypto",totalCount:2,assetCategoryData:[it("BTC","Bitcoin",0.012,20000000,"IDR",2100000),it("ETH","Ethereum",0.1,6000000,"IDR",-300000)]},
  {assetCategory:"global_equity",title:"US",totalCount:1,assetCategoryData:[it("AAPL","Apple Inc.",3,700,"USD",40)]},
  {assetCategory:"indo_stock",title:"IDX",totalCount:1,assetCategoryData:[it("BBCA","Bank Central Asia",5,4800000,"IDR",200000)]}]}}}
 return{};}
const mcp={callTool:async(s,t,i)=>({payload:pay(t,i)}),invalidate:async()=>{},watchTool:(s,t,i,cb)=>{setTimeout(()=>cb({type:"data",result:{payload:pay(t,i)}}),50);return()=>{}}};
window.claude={use:async()=>mcp};})();
