'use strict';
/* ===== Utilities ===== */
const $=(s,r=document)=>r.querySelector(s);
const seeded=s=>()=>(s=(s*16807)%2147483647)/2147483647;
const fmt=(n,d=2)=>n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});

/* ===== Synthetic market data & indicators ===== */
function genData(n,seed){const r=seeded(seed);let p=100,d=[];
  for(let i=0;i<n;i++){const o=p,c=o*(1+(r()-.47)*.026+Math.sin(i/16)*.002);
    d.push({o,c,h:Math.max(o,c)*(1+r()*.01),l:Math.min(o,c)*(1-r()*.01),v:500+r()*1000});p=c}return d}
const sma=(a,n)=>a.map((_,i)=>i<n-1?null:a.slice(i-n+1,i+1).reduce((x,y)=>x+y,0)/n);
const ema=(a,n)=>{const k=2/(n+1);let e=a[0];return a.map(v=>e=v*k+e*(1-k))};
function bollinger(c,n=20,m=2){const mid=sma(c,n);return mid.map((x,i)=>{if(x==null)return null;
  const sd=Math.sqrt(c.slice(i-n+1,i+1).reduce((s,v)=>s+(v-x)**2,0)/n);return{m:x,u:x+m*sd,l:x-m*sd}})}
function rsi(c,n=14){let g=0,l=0;return c.map((v,i)=>{if(!i)return null;const d=v-c[i-1];
  if(i<=n){g+=Math.max(d,0)/n;l+=Math.max(-d,0)/n}else{g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n}
  return i<n?null:100-100/(1+g/(l||1e-9))})}
function macd(c){const f=ema(c,12),s=ema(c,26),m=f.map((v,i)=>v-s[i]),sg=ema(m,9);return m.map((v,i)=>({m:v,s:sg[i],h:v-sg[i]}))}
const atr=(d,n=14)=>d.slice(-n).reduce((s,x)=>s+(x.h-x.l),0)/n;

/* ===== Strategy content ===== */
const STRATS=[
{name:'Momentum Breakout',side:1,rr:3,k:1.5,thesis:'Volatility contraction precedes expansion. Buy the first decisive close above a multi-week range when volume confirms participation.',
 rules:['Identify a base of 15+ bars with shrinking range (Bollinger Bands narrowing).','Enter on a close above range high with volume at least 1.5x the 20-bar average.','Place the stop below the breakout candle low, never wider than 1.5 ATR.','Trail half the position under the 10-bar EMA; take the rest at 3R.'],
 risk:'Risk 0.5–1% of equity per trade. Skip breakouts that occur straight into major higher-timeframe resistance.',on:['bb']},
{name:'Mean Reversion',side:1,rr:2,k:1,thesis:'In range-bound regimes, statistical extremes revert. Fade overextension only when the higher-timeframe trend is flat.',
 rules:['Confirm ADX below 20 or a flat 50-bar average.','Wait for a close outside the lower Bollinger Band with RSI below 30.','Enter on the next bar that closes back inside the band.','Target the middle band; exit fully if price makes a new extreme.'],
 risk:'Win rate is high but losses are fat-tailed. Cap size at 0.5% and never average down.',on:['bb','rsi']},
{name:'Liquidity Sweep',side:1,rr:3,k:1.2,thesis:'Resting stop orders cluster beyond obvious swing lows. Large players sweep them to fill size, then price reverses.',
 rules:['Mark equal lows or the prior day low where stops accumulate.','Require a wick through the level that closes back above it.','Enter on the retest of the reclaimed level; stop below the sweep wick.','Target the opposing liquidity pool, typically the last swing high.'],
 risk:'Failed sweeps become trend continuations. Respect the stop; the wick is your invalidation.',on:['fib','vp']},
{name:'Smart Money Concepts',side:-1,rr:2.5,k:1.3,thesis:'Institutional order flow leaves footprints: displacement, imbalance and order blocks that price tends to revisit.',
 rules:['Establish structure: a break of structure confirms bias.','Locate the last opposing candle before displacement (the order block).','Enter on the first return into the block, ideally within the 0.62–0.79 Fibonacci zone.','Stop beyond the block; target the next unmitigated imbalance.'],
 risk:'Trade only with higher-timeframe alignment. Two consecutive losses end the session.',on:['fib','macd']},
{name:'Options Volatility',side:1,rr:2,k:1.6,thesis:'Implied volatility usually exceeds realised volatility. Sell premium when IV rank is high, buy it when pricing is cheap.',
 rules:['Compare IV rank to a 52-week range; act above 60 or below 20.','Prefer defined-risk spreads: iron condors or put credit spreads.','Size so that max loss is at most 1% of equity.','Close at 50% of max profit or 21 days to expiry.'],
 risk:'Short volatility has negative skew. Avoid holding through earnings and macro events.',on:['bb','macd']}];

const PLATFORMS=[
['TradingView','Charting & social analysis','Best-in-class browser charting, 100+ indicators, Pine Script and a vast idea library.','Discretionary and systematic traders, all levels.','Real-time via exchange add-ons; broad global coverage.','https://www.tradingview.com'],
['Bloomberg Terminal','Institutional data & analytics','The industry standard for fixed income, FX, news, analytics and execution workflows.','Funds, banks, institutional desks.','Real-time global, proprietary and alternative data.','https://www.bloomberg.com/professional'],
['Finviz','Screening & heat maps','Fast fundamental and technical screener with the market heat map as its signature view.','Swing traders hunting setups.','Delayed free; real-time with Elite.','https://finviz.com'],
['Koyfin','Research & visual analytics','Terminal-style dashboards, fundamentals and macro in a modern interface.','Investors and analysts seeking depth without terminal cost.','Equities, ETFs, macro, estimates.','https://www.koyfin.com'],
['Yahoo Finance','Market overview & portfolios','Accessible quotes, news and portfolio tracking for a broad public audience.','Beginners and long-term investors.','Mostly delayed quotes; wide global scope.','https://finance.yahoo.com'],
['StockCharts','Classical technical analysis','Rigorous charting, market-breadth tools and educational ChartSchool.','Technicians and trend followers.','End-of-day and intraday US coverage.','https://stockcharts.com']];

const ARTICLES=[
['Market psychology','Price is the aggregate of fear and greed.','Every candle records a negotiation between participants with different horizons and incentives. Crowds overreact at extremes: panic compresses risk premia into forced selling, euphoria stretches valuations through anchoring and herding. The edge is not predicting emotion but recognising when positioning is one-sided. Disciplined traders pre-commit to rules, because loss aversion makes humans cut winners early and hold losers.','Fear ⇄ Greed','the two forces behind every market extreme','1,2,3,5,8,5,3,4,6,9,7'],
['Risk-to-reward mathematics','Expectancy beats win rate.','Expectancy equals win rate times average win minus loss rate times average loss. A strategy winning 40% of trades at 3R earns 0.6R per trade; one winning 70% at 0.5R earns only 0.05R after a 0.65 loss ratio is considered. Position sizing converts expectancy into growth: risking a fixed fraction keeps drawdowns survivable. A 50% drawdown demands a 100% gain to recover, which is why capital preservation dominates.','+0.6R','expectancy at 40% win rate and 3R payoff','2,2,3,4,5,7,8,10,12,15,18'],
['Macro correlations','Every asset trades inside a regime.','Real yields, the dollar and liquidity drive cross-asset behaviour. Rising real yields pressure long-duration growth stocks and gold; a strengthening dollar tightens global financial conditions and hurts commodities. Equity and bond correlations flip sign when inflation, not growth, is the dominant shock. Monitor the yield curve, credit spreads and the VIX term structure as regime indicators.','Regimes','correlations shift with the dominant macro shock','8,6,4,2,1,-1,-3,-2,2,5,7'],
['Order book mechanics','Liquidity is the hidden dimension of price.','The limit order book stacks resting bids and offers by price and time priority. Market orders consume depth and move the last traded price, so thin books produce slippage. Iceberg orders conceal true size, while spoofing attempts to mislead. Reading the tape alongside Level 2 and volume profile reveals where size absorbs aggression and where the path of least resistance lies.','L2','depth, tape and volume profile reveal intent','3,5,9,6,4,8,11,7,5,3,2']];

/* ===== Extra content ===== */
const MIST=[['Entering before the close confirms the break; many breaks fail intrabar.','Chasing extended moves far above the range with a wide stop.','Ignoring volume: breaks on thin volume fail more often.'],
['Averaging down into a trending market.','Using the strategy when the higher-timeframe trend is strong.','Targeting beyond the middle band, turning a quick reversion into a hope trade.'],
['Placing the stop at the exact obvious level instead of beyond the sweep wick.','Treating every wick as a sweep without a close back inside.','Ignoring higher-timeframe direction.'],
['Marking order blocks on every candle; only those that cause displacement matter.','Trading counter to higher-timeframe structure.','Moving stops after entry because the price feels uncomfortable.'],
['Selling premium without a defined maximum loss.','Holding short options through earnings or central-bank decisions.','Sizing by premium collected instead of by maximum loss.']];
const EXCH=[
['New York Stock Exchange','New York, USA','Its origins trace to the 1792 Buttonwood Agreement. Home to many of the largest US blue-chip listings.','https://www.nyse.com'],
['Nasdaq','New York, USA','Launched in 1971 as the first electronic stock market. Known for technology listings and the Nasdaq-100 index.','https://www.nasdaq.com'],
['London Stock Exchange','London, UK','Part of LSEG, with roots in 17th-century coffee houses. Benchmark index: FTSE 100.','https://www.lseg.com'],
['Japan Exchange Group','Tokyo, Japan','Formed in 2013 by merging Tokyo Stock Exchange and Osaka Securities Exchange. Indices: Nikkei 225 (published by Nikkei) and TOPIX.','https://www.jpx.co.jp/english/'],
['Shanghai Stock Exchange','Shanghai, China','Re-established in 1990. Main benchmark is the SSE Composite Index.','https://english.sse.com.cn'],
['Hong Kong Exchanges and Clearing','Hong Kong','Operates the Stock Exchange of Hong Kong, a gateway between China and global capital. Benchmark: Hang Seng Index.','https://www.hkex.com.hk'],
['Euronext','Amsterdam, Brussels, Paris and more','Created in 2000 by merging the Amsterdam, Brussels and Paris exchanges, later joined by others. Pan-European equities and derivatives.','https://www.euronext.com'],
['Deutsche Börse','Frankfurt, Germany','Runs the Xetra trading system and the Eurex derivatives market. Home of the DAX index.','https://www.deutsche-boerse.com'],
['CME Group','Chicago, USA','The world\'s leading futures marketplace by variety, including interest rates, equity indices, energy and metals. Chicago Board of Trade dates to 1848.','https://www.cmegroup.com'],
['Cboe Global Markets','Chicago, USA','Cboe created the first listed options exchange in 1973 and publishes the VIX volatility index.','https://www.cboe.com'],
['BSE (Bombay Stock Exchange)','Mumbai, India','Established in 1875, widely cited as Asia\'s oldest exchange. Benchmark: S&P BSE Sensex.','https://www.bseindia.com'],
['National Stock Exchange of India','Mumbai, India','Began trading in 1994. Benchmark: Nifty 50. Very high derivatives volume.','https://www.nseindia.com'],
['TMX Group','Toronto, Canada','Operates the Toronto Stock Exchange, a major hub for mining and energy listings. Benchmark: S&P/TSX Composite.','https://www.tmx.com'],
['SIX Swiss Exchange','Zurich, Switzerland','Switzerland\'s main exchange, home of Swiss blue chips in the Swiss Market Index (SMI).','https://www.six-group.com']];
const GLOSS=[['ATR','Average True Range: the mean of recent true ranges, used to size stops by typical bar movement.'],
['Bid-ask spread','The gap between the highest bid and lowest offer; a direct cost of trading.'],
['Slippage','The difference between the expected price and the executed price.'],
['Liquidity','How easily an asset trades without moving its price.'],
['Drawdown','The decline from a peak in equity to a subsequent trough.'],
['R-multiple','A result expressed in units of initial risk; +2R means twice the amount risked.'],
['Expectancy','Average result per trade: win rate × average win − loss rate × average loss.'],
['Position sizing','Choosing quantity so a stop-out loses a fixed fraction of equity.'],
['Leverage','Controlling exposure larger than your capital, which magnifies both gains and losses.'],
['Margin call','A broker demand for more funds or reduced positions when equity falls below maintenance levels.'],
['Short selling','Selling borrowed shares to profit from a decline; potential losses are unlimited.'],
['Market order','Executes immediately at the best available price; the price is not guaranteed.'],
['Limit order','Executes only at the specified price or better; execution is not guaranteed.'],
['Stop order','Becomes a market order once a trigger price trades.'],
['Level 2','Quotes showing order book depth beyond the best bid and offer.'],
['VWAP','Volume-weighted average price, a common institutional execution benchmark.'],
['Moving average','The average of the last N prices, smoothing noise to reveal trend.'],
['RSI','Relative Strength Index by J. Welles Wilder: a 0–100 momentum oscillator, 14 periods by default.'],
['MACD','The difference between 12- and 26-period exponential averages, plotted with a 9-period signal line.'],
['Bollinger Bands','A 20-period average with bands two standard deviations above and below.'],
['Fibonacci retracement','Horizontal levels (23.6%, 38.2%, 61.8%, 78.6%, plus the conventional 50%) drawn across a prior swing.'],
['Support and resistance','Price zones where buying or selling has repeatedly halted a move.'],
['Gap','When price opens away from the prior close with no trades in between.'],
['Implied volatility','The market\'s expectation of future volatility, derived from option prices.'],
['Delta','How much an option\'s price changes for a $1 move in the underlying.'],
['Theta','The amount an option loses per day from time decay.'],
['Open interest','The total number of outstanding derivative contracts not yet closed.'],
['Short squeeze','A rapid price rise that forces short sellers to buy back, accelerating the move.'],
['Beta','An asset\'s sensitivity to market moves; a beta of 1 moves with the market.'],
['Sharpe ratio','Excess return per unit of volatility, a measure of risk-adjusted performance.'],
['Correlation','A statistic from −1 to +1 describing how two series move together.'],
['Dark pool','A private venue where institutions trade without displaying quotes before execution.'],
['Market maker','A firm that continuously quotes both buy and sell prices, providing liquidity.'],
['Order block','A Smart Money Concepts term for the last opposing candle before a strong displacement move.'],
['Breakout','A close beyond a defined range or level, ideally with rising volume.']];
const SCEN_STOP=[2.5,1.8,1.2,1.5,4];
function renderScen(){const s=STRATS[state.i],sp=SCEN_STOP[state.i],rows=[];
  $('#scenTitle').textContent='20 worked scenarios · '+s.name;
  [40,185].forEach(e=>[0.5,1].forEach(r=>[10000,25000,50000,100000,250000].forEach(a=>{
    const rk=a*r/100,dist=e*sp/100,sh=Math.floor(rk/dist),sl=e-s.side*dist,tp=e+s.side*dist*s.rr;
    rows.push(`<tr><td>$${fmt(a,0)}</td><td>${r}%</td><td>$${fmt(e)}</td><td>$${fmt(sl)}</td><td>${fmt(sh,0)}</td><td>$${fmt(tp)}</td><td class="l">−$${fmt(sh*dist)}</td><td class="p">+$${fmt(sh*dist*s.rr)}</td></tr>`)})));
  $('#scenTable').innerHTML=`<tr><th>Account</th><th>Risk</th><th>Entry</th><th>Stop (${sp}%)</th><th>Shares</th><th>Target (${s.rr}R)</th><th>Max loss</th><th>Gain at target</th></tr>`+rows.join('')}
function renderExtras(){
  $('#exchGrid').innerHTML=EXCH.map(e=>`<article class="card glass tilt reveal"><span class="tag">${e[1]}</span><h3>${e[0]}</h3><p>${e[2]}</p><a href="${e[3]}" target="_blank" rel="noopener noreferrer">Official site →</a></article>`).join('');
  $('#glossary-list').innerHTML=GLOSS.map(g=>`<div><dt>${g[0]}</dt><dd>${g[1]}</dd></div>`).join('')}


/* ===== Brokers, handbook, extra articles ===== */
const BROK=[
['Interactive Brokers','Multi-asset broker','Founded in 1978 by Thomas Peterffy. Offers access to stocks, options, futures, forex and bonds across many countries; popular with active and professional traders.','https://www.interactivebrokers.com'],
['Charles Schwab','Full-service broker','Founded in 1971. Acquired TD Ameritrade in 2020, bringing the thinkorswim trading platform into its offering.','https://www.schwab.com'],
['Fidelity','Full-service broker','Founded in 1946 in Boston. One of the largest US retirement and brokerage providers.','https://www.fidelity.com'],
['Robinhood','Mobile-first broker','Founded in 2013 and widely credited with popularizing commission-free stock trading for retail users.','https://robinhood.com'],
['eToro','Social trading','Founded in 2007. Known for social and copy-trading features across stocks and crypto.','https://www.etoro.com'],
['Trade Republic','Mobile-first broker (Germany)','Berlin-based, founded in 2015. Focused on simple stock, ETF and savings-plan investing through a mobile app.','https://traderepublic.com'],
['Scalable Capital','Broker and robo-advisor (Germany)','Munich-based, founded in 2014. Combines a self-directed broker with automated portfolio management.','https://scalable.capital'],
['DEGIRO','Online broker (Netherlands)','Founded in 2008 and now part of flatexDEGIRO. Offers access to many European and international exchanges.','https://www.degiro.com'],
['Trading 212','Online broker','Founded in 2004. Offers stocks, ETFs and CFDs, with commission-free stock investing in several markets.','https://www.trading212.com'],
['IG','CFD and spread betting','Founded in London in 1974. A long-established provider of leveraged products, which carry a high risk of loss.','https://www.ig.com'],
['Saxo','Multi-asset broker','Danish investment bank founded in 1992, serving retail and institutional clients with its SaxoTraderGO platform.','https://www.home.saxo'],
['Binance','Crypto exchange','Founded in 2017. One of the largest crypto exchanges by trading volume, offering spot and derivatives markets.','https://www.binance.com'],
['Coinbase','Crypto exchange','Founded in 2012 and listed on Nasdaq in 2021. A major US-based crypto exchange and custody provider.','https://www.coinbase.com'],
['Kraken','Crypto exchange','Founded in 2011 by Jesse Powell. One of the longest-running crypto exchanges, with spot, margin and futures products.','https://www.kraken.com'],
['Bitget','Crypto exchange','Founded in 2018. Known for derivatives trading and its copy-trading feature.','https://www.bitget.com'],
['Bybit','Crypto exchange','Founded in 2018. Best known for crypto derivatives, with spot and other products added over time.','https://www.bybit.com'],
['OKX','Crypto exchange','A global crypto exchange offering spot, derivatives and an on-chain wallet product.','https://www.okx.com'],
['Bitpanda','Crypto and multi-asset (Austria)','Vienna-based, founded in 2014. Offers crypto alongside stocks, ETFs and metals in several European markets.','https://www.bitpanda.com']];
const DEEP=[
['Momentum Breakout',['<b>The logic.</b> Ranges compress as participants agree on value. When price closes decisively outside, resting stop orders trigger and late buyers join, adding fuel in the same direction. The edge is not the break itself but the asymmetry: a failed breakout is cheap to exit, a successful one can run for many multiples of risk.','<b>Filters that matter.</b> Prefer breakouts in an uptrending market, stocks with relative strength versus their index, a base of at least 15 bars, and volume of at least 1.5× the 20-bar average on the break. Avoid breaks directly beneath a major higher-timeframe resistance.','<b>Worked trade.</b> Entry $50.00, stop $48.75, so risk is $1.25 per share. A 3R target is $50.00 + 3 × $1.25 = $53.75. On a $25,000 account risking 1% ($250), position size is 250 ÷ 1.25 = 200 shares ($10,000 notional). At target the gain is 200 × $3.75 = $750. With a 35% hit rate the expectancy is 0.35 × 3 − 0.65 × 1 = +0.40R per trade.','<b>Failure modes.</b> Chasing extended moves, ignoring volume and widening the stop after entry. Expect many small losses; the strategy pays through a minority of large winners.']],
['Mean Reversion',['<b>The logic.</b> In range-bound markets, price oscillates around a fair value and extremes tend to snap back. The trade monetises overreaction: panic or euphoria stretches price beyond what information justifies.','<b>Regime filter.</b> Use it only when trend strength is low, for example a flat 50-bar average or ADX below 20. In strong trends, a statistically extreme reading is the market telling you the trend is intact, not that it is about to reverse.','<b>Worked trade.</b> Price closes at $96.00 below the lower Bollinger Band, then back inside. Entry $96.50, stop $95.00 (risk $1.50), target the middle band at $100.00 (reward $3.50), a reward-to-risk of 3.50 ÷ 1.50 ≈ 2.33R. With 65% winners at +1R and 35% losers at −1.5R, expectancy is 0.65 × 1 − 0.35 × 1.5 = +0.125R: positive, but thin, so costs matter.','<b>Failure modes.</b> Averaging down into a trend, holding past the target and trading without a regime filter. The profile is many small wins and occasional large losses, so strict stops are essential.']],
['Liquidity Sweep',['<b>The logic.</b> Stop orders cluster beyond obvious swing highs and lows. Large participants need counterparties to fill size; pushing price through those clusters releases liquidity. Once the orders are absorbed, price often reverses sharply.','<b>Confirmation.</b> The key is the close: a wick through the level that closes back inside signals rejection. A close beyond the level with follow-through is a breakout, not a sweep. Higher-timeframe levels such as the prior day or week low carry the most weight.','<b>Worked trade.</b> Prior low $20.00. Price wicks to $19.70 and closes at $20.15. Entry on the retest at $20.10, stop below the wick at $19.65 (risk $0.45), target the prior swing high at $21.45 (reward $1.35): exactly 3R. Risking $200 allows 200 ÷ 0.45 = 444 shares.','<b>Failure modes.</b> Treating every wick as a sweep, placing stops at the obvious level instead of beyond the wick, and fighting a strong higher-timeframe trend.']],
['Smart Money Concepts',['<b>The logic.</b> The framework assumes large orders leave footprints: a displacement move (strong, one-directional candles), a break of structure, and an order block, the last opposing candle before the move. Price frequently returns to these zones before continuing.','<b>Discipline.</b> The vocabulary is easy to misuse. A valid setup needs higher-timeframe alignment, a clear break of structure and a defined invalidation. Marking zones on every candle produces many contradictory signals.','<b>Worked trade (short).</b> After a bearish break of structure, the order block spans $105.00–$105.60. Entry $105.30, stop above the block at $105.80 (risk $0.50), target the next imbalance at $104.05 (reward $1.25): 2.5R. A $500 risk budget allows 1,000 shares.','<b>Failure modes.</b> Subjective zone drawing, over-trading and moving stops. Journal every trade with a screenshot so the rules stay testable rather than interpretive.']],
['Options Volatility',['<b>The logic.</b> Option prices embed implied volatility. Historically implied volatility has tended to exceed subsequently realised volatility, which is the premium sellers aim to collect. The cost is negative skew: many small gains and rare large losses.','<b>Structure.</b> Defined-risk spreads cap the loss. Compare current implied volatility with its trailing one-year range (IV rank) and prefer selling premium when it is elevated, buying when cheap. Avoid holding short premium through earnings and central-bank decisions.','<b>Worked trade (iron condor).</b> Underlying at $100. Sell the 95 put and buy the 90 put; sell the 105 call and buy the 110 call. Net credit $1.50 per share ($150 per contract). Width is $5, so max loss = $5 − $1.50 = $3.50 ($350 per contract) and max profit is $150. Breakevens: $95 − $1.50 = $93.50 and $105 + $1.50 = $106.50. Closing at 50% of max profit means buying back for about $75. With 1% risk on $50,000 ($500), one contract fits ($350); two would risk $700.','<b>Failure modes.</b> Selling naked premium, sizing by credit received instead of maximum loss, and ignoring early assignment on short American-style options.']]];
ARTICLES.push(
['Position sizing and Kelly','Size is the variable you fully control.','The Kelly criterion estimates the growth-optimal bet fraction: f = (b × p − q) ÷ b, where p is win probability, q = 1 − p and b is the payoff ratio. With a 40% win rate and a 3:1 payoff, f = (3 × 0.4 − 0.6) ÷ 3 = 20%. Full Kelly produces severe drawdowns and assumes perfectly known inputs, so practitioners typically use a fraction of it, or a fixed risk of 0.5–1% per trade.','20%','full-Kelly fraction at a 40% win rate and 3:1 payoff','3,4,6,5,8,9,7,10,11,9,12'],
['Backtesting pitfalls','A backtest is a hypothesis, not a result.','Overfitting tunes parameters to past noise. Survivorship bias drops delisted failures from the data. Look-ahead bias uses information unavailable at decision time. Ignoring spread, commissions and slippage can turn a paper edge negative. Remedies include out-of-sample testing, walk-forward analysis, simple rules with few parameters and conservative cost assumptions.','3 biases','overfitting, survivorship, look-ahead','5,5,6,9,4,3,7,8,6,5,4'],
['Volatility regimes','Calm breeds calm; turbulence clusters.','Volatility clusters: large moves tend to follow large moves, and quiet periods follow quiet periods. Strategies suit regimes: breakouts tend to follow compression, mean reversion fits low-trend ranges, and option selling works best when implied volatility is rich. The VIX measures the 30-day volatility of the S&P 500 implied by index options.','VIX','30-day implied S&P 500 volatility','2,2,3,3,8,11,9,6,4,3,3'],
['Trading psychology','Your biggest risk sits behind the keyboard.','Prospect theory, developed by Daniel Kahneman and Amos Tversky, shows that people feel losses more strongly than equal gains. In trading this appears as cutting winners early and holding losers. Countermeasures: pre-defined stops, fixed position size, a written pre-trade checklist and a journal that records reasoning, emotion and outcome for every trade.','Journal','record reasoning, emotion and outcome','4,5,5,6,6,7,8,8,9,10,11'],
['Market hours and sessions','Time of day changes the game.','US equities trade in a regular session from 9:30 to 16:00 Eastern Time, with extended pre-market and after-hours trading around it. The open and close tend to bring the highest volume and sharpest moves, while midday is often quieter. Forex trades around the clock on weekdays and crypto trades continuously, so liquidity varies by session overlap.','9:30–16:00','US regular session, Eastern Time','9,7,5,4,3,3,4,5,6,8,10'],
['Diversification and correlation','Correlation decides whether two bets are really two.','Two assets with a correlation of +1 provide no diversification, while −1 offsets fully. Portfolio risk depends on the weights, each asset\'s volatility and their correlations. In market stress, correlations between risky assets often rise, so diversification can weaken exactly when it is needed. Check overlap in sector, factor and macro exposure, not just ticker count.','−1 to +1','the range of correlation','6,5,7,4,6,3,8,5,7,4,6']);
function renderMore(){
  $('#brokGrid').innerHTML=BROK.map(e=>`<article class="card glass tilt reveal"><span class="tag">${e[1]}</span><h3>${e[0]}</h3><p>${e[2]}</p><a href="${e[3]}" target="_blank" rel="noopener noreferrer">Official site →</a></article>`).join('');
  $('#chapters').innerHTML=DEEP.map((c,i)=>`<div class="chapter reveal"><div><p class="eyebrow">Chapter ${i+1}</p><h2>${c[0]}</h2></div><div>${c[1].map(p=>`<p>${p}</p>`).join('')}</div></div>`).join('')}


/* ===== Patterns, regimes, risk, options ===== */
PLATFORMS.push(
['Morningstar','Fund & equity research','Independent research, ratings and analytics, especially strong for funds and ETFs. Founded in Chicago in 1984.','Long-term investors and portfolio builders.','Fund, ETF and equity fundamentals.','https://www.morningstar.com'],
['FRED','Official economic data','Free database from the Federal Reserve Bank of St. Louis with hundreds of thousands of economic time series, including rates, inflation and employment.','Macro analysts and anyone verifying economic claims.','Primary-source macro data, downloadable and chartable.','https://fred.stlouisfed.org'],
['SEC EDGAR','Official company filings','The US Securities and Exchange Commission database of company filings such as 10-K annual reports, 10-Q quarterlies and 8-K event reports.','Fundamental investors who want primary sources.','Free, unedited regulatory filings.','https://www.sec.gov/edgar'],
['Investing.com','Calendars & market overview','Broad coverage of quotes, news and an economic calendar showing scheduled data releases and central-bank events.','Event-aware traders planning around releases.','Global quotes, many delayed.','https://www.investing.com'],
['Seeking Alpha','Investor research','Platform for investment analysis written largely by contributors, plus earnings transcripts and ratings. Treat opinions as inputs, not conclusions.','Investors gathering a range of viewpoints.','Articles, transcripts, fundamentals.','https://seekingalpha.com'],
['Barchart','Screening & futures data','Screeners, options data and commodity and futures coverage alongside equities.','Traders of futures and options flows.','Equities, futures, options.','https://www.barchart.com'])
ARTICLES.push(
['Pre-market routine','Consistency starts before the open.','A reliable routine: (1) check overnight news, index futures and the economic calendar; (2) mark key levels on higher timeframes; (3) scan the watchlist for setups matching your written rules; (4) set the maximum risk for the day; (5) write if-then plans, for example if price closes above X, buy with a stop at Y; (6) after the close, log results and screenshots. The routine matters because decisions made before the open are calmer than decisions made during volatility.','6 steps','from news check to end-of-day review','3,4,5,6,7,8,9,9,8,7,6'],
['Reading financial statements','Three statements, one story.','The income statement reports revenue and profit over a period. The balance sheet is a snapshot where assets equal liabilities plus equity. The cash flow statement tracks cash from operating, investing and financing activities. Key ratios: P/E = price ÷ earnings per share (a $150 price with $5 EPS gives a P/E of 30), and free cash flow = operating cash flow − capital expenditure. Compare ratios within an industry, not across them.','A = L + E','the balance sheet identity','5,6,6,7,8,8,9,9,10,10,11']);
GLOSS.push(['P/E ratio','Share price divided by earnings per share; a common valuation gauge best compared within one industry.'],
['EPS','Earnings per share: net income attributable to shareholders divided by shares outstanding.'],
['Market capitalization','Share price multiplied by shares outstanding; it measures company size.'],
['Float','The shares available for public trading, excluding those held by insiders and strategic holders.'],
['Dividend yield','Annual dividend per share divided by the share price.'],
['Yield curve','A chart of government bond yields across maturities; an inverted curve has short-term yields above long-term yields.'],
['Free cash flow','Operating cash flow minus capital expenditure; cash available after maintaining the business.']);
const PAT=[
['Head and shoulders','Bearish reversal','Three peaks with the middle one highest and the shoulders roughly level; the neckline joins the two troughs.','Confirmed by a close below the neckline. Target = head − neckline, projected down from the neckline.','Head 120, neckline 100: height 20, target ≈ 80.'],
['Double top','Bearish reversal','Two peaks near the same level separated by a trough. The inverse, a double bottom, is bullish.','Confirmed by a close below the trough. Target = peak − trough, projected down.','Peaks 50, trough 45: height 5, target ≈ 40.'],
['Ascending triangle','Bullish continuation','Flat resistance with a rising series of lows; buyers accept higher prices each test.','Breakout above resistance. Target = widest height added to the breakout.','Resistance 80, first low 70: height 10, target ≈ 90.'],
['Bull flag','Bullish continuation','A sharp advance (the pole) followed by a shallow, orderly pullback in a down-sloping channel.','Breakout above the flag. Target = pole length added to the breakout.','Pole 40 to 50 (10), break at 48: target ≈ 58.'],
['Cup and handle','Bullish continuation','A rounded base followed by a short, shallow pullback (the handle) below the rim.','Breakout above the rim. Target = cup depth added to the rim.','Rim 60, cup low 48: depth 12, target ≈ 72.'],
['Rising wedge','Typically bearish','Price makes higher highs and higher lows inside a narrowing, upward-sloping channel, showing fading momentum.','A close below the lower trendline. A common target is a retrace to where the wedge began.','Wedge begins at 70, tops at 90: target zone ≈ 70.'],
['Engulfing candle','Reversal signal','A candle whose body fully covers the prior candle body of the opposite colour.','Matters only at support or resistance. Stop beyond the engulfing candle.','Bullish engulfing at 100 support: stop under the candle low.'],
['Hammer / shooting star','Reversal signal','A small body with a long wick, conventionally at least twice the body. A hammer forms after declines; a shooting star after advances.','Needs confirmation from the next candle. Stop beyond the wick.','Hammer low 98, close 99.5: stop just under 98.']];
const REG=[['Strong uptrend','Favorable','Avoid','Neutral','Favorable','Neutral'],
['Range-bound','Avoid','Favorable','Favorable','Neutral','Favorable'],
['Volatility compression','Favorable','Neutral','Neutral','Neutral','Favorable'],
['Volatility spike','Neutral','Avoid','Neutral','Neutral','Neutral'],
['Major event risk','Avoid','Avoid','Avoid','Avoid','Avoid']];
function renderRisk(){
  $('#patGrid').innerHTML=PAT.map(p=>`<article class="card glass tilt reveal"><span class="tag">${p[1]}</span><h3>${p[0]}</h3><p>${p[2]}</p><dl><div><dt>Rule</dt><dd>${p[3]}</dd></div></dl><span class="ex">${p[4]}</span></article>`).join('');
  $('#regTable').innerHTML='<tr><th>Regime</th>'+STRATS.map(s=>`<th>${s.name}</th>`).join('')+'</tr>'+REG.map(r=>`<tr><td>${r[0]}</td>${r.slice(1).map(v=>`<td class="${v==='Favorable'?'p':v==='Avoid'?'l':'n'}">${v}</td>`).join('')}</tr>`).join('');
  const rec=[10,20,30,40,50,60,70,90].map(x=>`<tr><td>−${x}%</td><td>+${fmt((1/(1-x/100)-1)*100,1)}%</td></tr>`).join('');
  const str=[30,40,50,60].map(w=>`<tr><td>${w}%</td>${[3,5,8,10].map(n=>`<td>${fmt(Math.pow(1-w/100,n)*100,1)}%</td>`).join('')}</tr>`).join('');
  const pl=[90,95,100,103,105,110,115,120].map(s=>{const v=(Math.max(s-100,0)-3)*100;return `<tr><td>$${s}</td><td class="${v>0?'p':v<0?'l':'n'}">${v>0?'+':v<0?'−':''}$${fmt(Math.abs(v),0)}</td></tr>`}).join('');
  const C=(e,t,b)=>`<div class="chapter reveal"><div><p class="eyebrow">${e}</p><h2>${t}</h2></div><div>${b}</div></div>`;
  $('#riskBody').innerHTML=
  C('Rulebook','Ten rules that keep you in the game',`<ol><li><b>Risk 0.5–1% of equity per trade.</b> At 1%, ten straight losses cost about 9.6%, since 0.99<sup>10</sup> ≈ 0.904.</li><li><b>Set a daily loss limit</b>, for example 2–3%, and stop trading for the day when it is hit.</li><li><b>Add a drawdown circuit breaker.</b> Many traders halve their size after a drawdown of around 5% until they recover.</li><li><b>Cap total open risk.</b> Add up the distance to every stop; keep the sum within a fixed share of equity.</li><li><b>Treat correlated positions as one.</b> Three tech stocks are largely one bet.</li><li><b>Define exit and target before entry.</b></li><li><b>Never add to a losing position.</b></li><li><b>Scale size with volatility.</b> Wider ATR means smaller size for the same dollar risk.</li><li><b>Journal every trade</b> with setup, reasoning, screenshot and result.</li><li><b>Review weekly</b> and change rules only after a meaningful sample, not after a single loss.</li></ol>`)+
  C('Drawdown math','Why losses are harder to repair than they look',`<p>Recovery required = 1 ÷ (1 − loss) − 1. The relationship is non-linear, which is why capital preservation dominates long-term results.</p><div class="tablewrap"><table><tr><th>Loss</th><th>Gain needed to recover</th></tr>${rec}</table></div>`)+
  C('Losing streaks','Even good strategies lose several times in a row',`<p>Probability of n consecutive losses = (1 − win rate)<sup>n</sup>, assuming independent trades. Streaks that feel like proof the system is broken are often normal variance.</p><div class="tablewrap"><table><tr><th>Win rate</th><th>3 losses</th><th>5 losses</th><th>8 losses</th><th>10 losses</th></tr>${str}</table></div>`)+
  C('Options Greeks','Five sensitivities of an option price',`<p><b>Delta</b> is the price change per $1 move in the underlying; a 0.50 delta call behaves roughly like 50 shares per contract of 100. <b>Gamma</b> is how fast delta itself changes and is highest near the strike close to expiry. <b>Theta</b> is daily time decay; −0.05 means about $5 lost per contract per day, all else equal. <b>Vega</b> is the change per one point of implied volatility; 0.10 is about $10 per contract. <b>Rho</b> is sensitivity to interest rates and is usually the smallest.</p><p><b>Long call at expiry.</b> Strike $100, premium $3.00 ($300 per contract). Break-even = $103; maximum loss = $300; upside is theoretically unlimited.</p><div class="tablewrap"><table><tr><th>Price at expiry</th><th>Profit / loss per contract</th></tr>${pl}</table></div>`);
}


ARTICLES.push(
['Volume analysis','Volume is the vote count behind price.','Price rising on expanding volume suggests broad participation; price rising on shrinking volume suggests fading conviction. On-Balance Volume, introduced by Joseph Granville, adds volume on up-closes and subtracts it on down-closes to reveal accumulation or distribution. VWAP resets each session and shows the average price paid, weighted by volume. A volume profile plots traded volume by price level; the price with the most volume is the point of control, which often acts as a magnet and a reference for support and resistance.','POC','point of control: the price with the most traded volume','3,3,4,5,12,6,4,3,3,2,2'],
['Forex market structure','The largest market has no central exchange.','Currencies trade over the counter, around the clock on weekdays, across the Sydney, Tokyo, London and New York sessions. A pip is 0.0001 for most pairs and 0.01 for yen pairs. A standard lot is 100,000 units, so on EUR/USD one pip is worth $10 per standard lot, $1 per mini lot (10,000 units). A one-pip spread on one standard lot therefore costs $10 per trade. Liquidity peaks during the London and New York overlap.','$10','one pip on a standard EUR/USD lot','4,5,6,8,11,12,9,6,5,4,3'],
['Futures and commodities','Standardised contracts with expiry dates.','A futures contract fixes size, tick value and expiry. The E-mini S&P 500 contract has a multiplier of $50 per index point and a tick of 0.25 points, worth $12.50. At an index level of 5,000 one contract controls 50 × 5,000 = $250,000 of exposure, which is why margin and sizing matter. When futures trade above spot the curve is in contango; below spot it is in backwardation. Most speculators close or roll positions before expiry.','$50','per index point on one E-mini S&P 500 future','3,4,4,6,7,9,9,10,11,12,12'],
['Building a trading plan','A plan turns ideas into testable rules.','A complete plan states: which markets and timeframes you trade; exact setup definitions; entry, stop and target rules; position-sizing formula; when you stop trading; and how results are reviewed. Write every rule so another person could apply it without asking you questions. Test it on historical data, then trade it in a simulator or at minimal size and collect a meaningful sample of trades before scaling. Revise the plan on a schedule, not in the middle of a drawdown.','Plan','markets, setups, rules, sizing, review','2,3,5,6,7,8,9,10,10,11,12']);

/* ===== Chart renderer ===== */
function setup(cv,h){const dpr=devicePixelRatio||1,w=cv.clientWidth;cv.width=w*dpr;cv.height=h*dpr;cv.style.height=h+'px';
  const x=cv.getContext('2d');x.scale(dpr,dpr);return{x,w,h}}

function drawChart(cv,o){
  const {x,w,h}=setup(cv,o.h),d=o.data,N=o.n,off=d.length-N,V=d.slice(off),
    sub=o.rsi||o.macd,mh=sub?h*.68:h-24,padR=o.labels?70:8,cw=(w-padR)/N;
  const cl=d.map(c=>c.c),B=bollinger(cl).slice(off),R=rsi(cl).slice(off),M=macd(cl).slice(off);
  let hi=Math.max(...V.map(c=>c.h)),lo=Math.min(...V.map(c=>c.l));
  if(o.bb){B.forEach(b=>{if(b){hi=Math.max(hi,b.u);lo=Math.min(lo,b.l)}})}
  if(o.setup){hi=Math.max(hi,o.setup.tp,o.setup.sl);lo=Math.min(lo,o.setup.tp,o.setup.sl)}
  const pad=(hi-lo)*.05;hi+=pad;lo-=pad;
  const Y=p=>(hi-p)/(hi-lo)*(mh-10)+5,X=i=>i*cw+cw/2;
  x.clearRect(0,0,w,h);x.font='11px '+getComputedStyle(document.body).fontFamily;
  x.strokeStyle='rgba(255,255,255,.06)';x.fillStyle='#8e8e93';
  for(let i=0;i<=4;i++){const p=lo+(hi-lo)*i/4,y=Y(p);x.beginPath();x.moveTo(0,y);x.lineTo(w-padR,y);x.stroke();if(o.labels)x.fillText(fmt(p),w-padR+8,y+4)}
  /* Volume profile */
  if(o.vp){const bins=24,vb=Array(bins).fill(0);V.forEach(c=>{const b=Math.min(bins-1,Math.floor((c.c-lo)/(hi-lo)*bins));vb[b]+=c.v});
    const m=Math.max(...vb);vb.forEach((v,b)=>{const y=Y(lo+(b+1)/bins*(hi-lo)),bh=mh/bins-1;
      x.fillStyle='rgba(0,229,255,.18)';x.fillRect(0,y,v/m*w*.22,bh)})}
  /* Fibonacci */
  if(o.fib){const sh=Math.max(...V.map(c=>c.h)),sl=Math.min(...V.map(c=>c.l));
    [0,.236,.382,.5,.618,.786,1].forEach(f=>{const p=sh-(sh-sl)*f,y=Y(p);x.strokeStyle='rgba(255,214,10,.45)';x.setLineDash([4,4]);
      x.beginPath();x.moveTo(0,y);x.lineTo(w-padR,y);x.stroke();x.setLineDash([]);x.fillStyle='rgba(255,214,10,.9)';x.fillText(f,6,y-3)})}
  /* Bollinger */
  if(o.bb){const line=(k,c,wd)=>{x.beginPath();let s=0;B.forEach((b,i)=>{if(!b)return;s?x.lineTo(X(i),Y(b[k])):(x.moveTo(X(i),Y(b[k])),s=1)});x.strokeStyle=c;x.lineWidth=wd;x.stroke()};
    x.beginPath();let s=0;B.forEach((b,i)=>{if(!b)return;s?x.lineTo(X(i),Y(b.u)):(x.moveTo(X(i),Y(b.u)),s=1)});
    for(let i=B.length-1;i>=0;i--)if(B[i])x.lineTo(X(i),Y(B[i].l));x.fillStyle='rgba(0,229,255,.06)';x.fill();
    line('u','rgba(0,229,255,.7)',1);line('l','rgba(0,229,255,.7)',1);line('m','rgba(255,255,255,.35)',1)}
  /* Candles */
  V.forEach((c,i)=>{const up=c.c>=c.o,col=up?'#00F59B':'#ff453a';x.strokeStyle=x.fillStyle=col;x.lineWidth=1;
    x.beginPath();x.moveTo(X(i),Y(c.h));x.lineTo(X(i),Y(c.l));x.stroke();
    const t=Y(Math.max(c.o,c.c)),bh=Math.max(1,Math.abs(Y(c.o)-Y(c.c)));x.fillRect(X(i)-cw*.33,t,cw*.66,bh)});
  /* Trade setup zones */
  if(o.setup){const s=o.setup,x0=w-padR-cw*18,wd=cw*18;
    x.fillStyle='rgba(0,245,155,.14)';x.fillRect(x0,Y(Math.max(s.en,s.tp)),wd,Math.abs(Y(s.tp)-Y(s.en)));
    x.fillStyle='rgba(255,69,58,.16)';x.fillRect(x0,Y(Math.max(s.en,s.sl)),wd,Math.abs(Y(s.sl)-Y(s.en)));
    [[s.en,'#fff','ENTRY'],[s.tp,'#00F59B','TP'],[s.sl,'#ff453a','SL']].forEach(([p,c,t])=>{x.strokeStyle=c;x.setLineDash([6,3]);x.beginPath();x.moveTo(x0,Y(p));x.lineTo(w-padR,Y(p));x.stroke();x.setLineDash([]);x.fillStyle=c;x.fillText(t+' '+fmt(p),x0+6,Y(p)-4)})}
  /* Sub-panes */
  if(sub){const top=mh+16,sh=h-top-4;x.strokeStyle='rgba(255,255,255,.08)';x.strokeRect(0,top,w-padR,sh);
    if(o.rsi){const Ry=v=>top+(100-v)/100*sh;[30,70].forEach(v=>{x.strokeStyle='rgba(255,255,255,.15)';x.setLineDash([3,3]);x.beginPath();x.moveTo(0,Ry(v));x.lineTo(w-padR,Ry(v));x.stroke();x.setLineDash([])});
      x.beginPath();let s=0;R.forEach((v,i)=>{if(v==null)return;s?x.lineTo(X(i),Ry(v)):(x.moveTo(X(i),Ry(v)),s=1)});x.strokeStyle='#bf5af2';x.lineWidth=1.5;x.stroke();x.fillStyle='#bf5af2';x.fillText('RSI 14',6,top+13)}
    else{const mx=Math.max(...M.map(v=>Math.abs(v.m)),...M.map(v=>Math.abs(v.h)))||1,My=v=>top+sh/2-v/mx*sh/2*.9;
      M.forEach((v,i)=>{x.fillStyle=v.h>=0?'rgba(0,245,155,.55)':'rgba(255,69,58,.55)';x.fillRect(X(i)-cw*.3,Math.min(My(0),My(v.h)),cw*.6,Math.abs(My(v.h)-My(0)))});
      [['m','#00E5FF'],['s','#ff9f0a']].forEach(([k,c])=>{x.beginPath();M.forEach((v,i)=>i?x.lineTo(X(i),My(v[k])):x.moveTo(X(i),My(v[k])));x.strokeStyle=c;x.lineWidth=1.3;x.stroke()});
      x.fillStyle='#8e8e93';x.fillText('MACD 12,26,9',6,top+13)}}
}

/* ===== Strategy Lab ===== */
const DATA=genData(160,7),state={i:0,bb:1,rsi:0,macd:0,vp:0,fib:0};
const TOG=[['bb','Bollinger Bands'],['rsi','RSI'],['macd','MACD'],['vp','Volume Profile'],['fib','Fibonacci']];
function setupFor(s){const en=DATA.at(-1).c,a=atr(DATA),risk=a*s.k;return{en,sl:en-s.side*risk,tp:en+s.side*risk*s.rr,risk,rr:s.rr}}
function renderLab(){
  const s=STRATS[state.i],t=setupFor(s);
  $('#stratBody').innerHTML=`<h3>${s.name}</h3><p>${s.thesis}</p><h4>Execution rules</h4><ol>${s.rules.map(r=>`<li>${r}</li>`).join('')}</ol>
  <h4>Risk framework</h4><p>${s.risk}</p><h4>Common mistakes</h4><ul class="mist">${MIST[state.i].map(m=>`<li>${m}</li>`).join('')}</ul><h4>Worked example · ${s.side>0?'Long':'Short'}</h4>
  <div class="setup"><div><small>Entry</small>${fmt(t.en)}</div><div><small>Stop-loss</small>${fmt(t.sl)}</div><div><small>Take-profit</small>${fmt(t.tp)}</div></div>
  <p style="margin-top:12px">Risk per unit: ${fmt(t.risk)} · Reward-to-risk: ${s.rr}:1 · Break-even win rate: ${fmt(100/(1+s.rr),1)}%.</p>`;
  renderScen();
  document.querySelectorAll('.tab').forEach((b,i)=>b.classList.toggle('on',i===state.i));
  document.querySelectorAll('.tg').forEach(b=>b.classList.toggle('on',!!state[b.dataset.k]));
  drawChart($('#labChart'),{data:DATA,n:90,h:460,labels:1,bb:state.bb,rsi:state.rsi,macd:state.macd&&!state.rsi,vp:state.vp,fib:state.fib,setup:t});
}
function initLab(){
  $('#stratTabs').innerHTML=STRATS.map((s,i)=>`<button class="tab" role="tab" data-i="${i}">${s.name}</button>`).join('');
  $('#toggles').innerHTML=TOG.map(([k,n])=>`<button class="tg" data-k="${k}">${n}</button>`).join('');
  $('#stratTabs').onclick=e=>{const b=e.target.closest('.tab');if(!b)return;state.i=+b.dataset.i;STRATS[state.i].on.forEach(()=>0);
    TOG.forEach(([k])=>state[k]=STRATS[state.i].on.includes(k)?1:0);renderLab()};
  $('#toggles').onclick=e=>{const b=e.target.closest('.tg');if(!b)return;const k=b.dataset.k;state[k]=state[k]?0:1;
    if(k==='rsi'&&state.rsi)state.macd=0;if(k==='macd'&&state.macd)state.rsi=0;renderLab()};
  TOG.forEach(([k])=>state[k]=STRATS[0].on.includes(k)?1:0);renderLab();
}

/* ===== Platforms & articles ===== */
function renderPlatforms(){$('#platformGrid').innerHTML=PLATFORMS.map(p=>`<article class="card glass tilt reveal">
  <span class="tag">${p[1]}</span><h3>${p[0]}</h3><p>${p[2]}</p>
  <dl><div><dt>Ideal for</dt><dd>${p[3]}</dd></div><div><dt>Data</dt><dd>${p[4]}</dd></div></dl>
  <a href="${p[5]}" target="_blank" rel="noopener noreferrer">Visit ${p[0]} →</a></article>`).join('')}
function renderArticles(){$('#articles').innerHTML=ARTICLES.map(a=>{const v=a[5].split(',').map(Number),m=Math.max(...v.map(Math.abs));
  return `<div class="article reveal"><div class="viz glass tilt"><div class="big grad">${a[3]}</div><small>${a[4]}</small>
  <div class="bars">${v.map(n=>`<i style="height:${Math.max(6,Math.abs(n)/m*100)}%"></i>`).join('')}</div></div>
  <div><p class="eyebrow">${a[0]}</p><h2>${a[1]}</h2><p>${a[2]}</p></div></div>`}).join('')}

/* ===== Hero chart (animated) ===== */
function initHero(){const cv=$('#heroChart'),d=genData(120,21);let n=40;
  const tick=()=>{drawChart(cv,{data:d.slice(0,80+Math.min(n,40)),n:60,h:260,bb:1,vp:0});
};
  tick();setInterval(()=>{n=n>=40?0:n+1;tick()},1600)}

/* ===== Scroll reveal ===== */
function initReveal(){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el))}

/* ===== Boot ===== */
renderExtras();renderMore();renderRisk();renderPlatforms();renderArticles();initHero();initLab();initReveal();
let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(renderLab,150)});
