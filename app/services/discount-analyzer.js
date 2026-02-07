/**
 * Discount Analyzer Service
 * Core business logic for calculating discount profitability
 */

/**
 * Calculate breakeven multiplier for a discount
 * How many more units need to be sold to break even after applying discount
 * 
 * @param {number} regularPrice - Original product price
 * @param {number} cost - Cost per item
 * @param {number} discountPercent - Discount percentage (0-100)
 * @returns {number} Breakeven multiplier (e.g., 1.5 = need to sell 50% more units)
 */
export function calculateBreakevenMultiplier(regularPrice, cost, discountPercent) {
  const regularMargin = regularPrice - cost;
  const discountedPrice = regularPrice * (1 - discountPercent / 100);
  const discountedMargin = discountedPrice - cost;
  
  // If discounted margin is zero or negative, discount is never profitable
  if (discountedMargin <= 0) {
    return Infinity;
  }
  
  return regularMargin / discountedMargin;
}

/**
 * Calculate ROI of a discount campaign
 * 
 * @param {Object} params
 * @param {number} params.salesWithDiscount - Units sold during discount period
 * @param {number} params.salesWithoutDiscount - Units sold in comparison period (baseline)
 * @param {number} params.regularPrice - Original product price
 * @param {number} params.discountedPrice - Price after discount
 * @param {number} params.cost - Cost per item
 * @returns {Object} ROI metrics
 */
export function calculateDiscountROI({
  salesWithDiscount,
  salesWithoutDiscount,
  regularPrice,
  discountedPrice,
  cost
}) {
  const regularMargin = regularPrice - cost;
  const discountedMargin = discountedPrice - cost;
  
  const profitWithoutDiscount = salesWithoutDiscount * regularMargin;
  const profitWithDiscount = salesWithDiscount * discountedMargin;
  
  const additionalProfit = profitWithDiscount - profitWithoutDiscount;
  const lostMarginPerUnit = regularMargin - discountedMargin;
  const totalLostMargin = salesWithDiscount * lostMarginPerUnit;
  
  // ROI = (Gain - Cost) / Cost * 100
  const roi = totalLostMargin > 0 
    ? (additionalProfit / totalLostMargin) * 100 
    : (additionalProfit > 0 ? Infinity : 0);
  
  const isProfitable = additionalProfit > 0;
  
  // Calculate profitability score (0-100)
  let profitabilityScore = 50; // neutral
  if (isProfitable) {
    // Positive ROI increases score
    profitabilityScore = Math.min(100, 50 + Math.floor(roi / 2));
  } else {
    // Negative ROI decreases score
    profitabilityScore = Math.max(0, 50 + Math.floor(roi / 2));
  }
  
  return {
    profitWithDiscount,
    profitWithoutDiscount,
    additionalProfit,
    lostMargin: totalLostMargin,
    roi,
    isProfitable,
    profitabilityScore
  };
}

/**
 * Analyze a discount code's overall performance
 * 
 * @param {Object} params
 * @param {Array} params.ordersWithDiscount - Orders that used this discount
 * @param {Array} params.comparisonOrders - Orders without discount (baseline)
 * @param {number} params.discountValue - Discount percentage or amount
 * @param {string} params.discountType - 'percentage' or 'fixed_amount'
 * @returns {Object} Discount analysis results
 */
export function analyzeDiscountPerformance({
  ordersWithDiscount,
  comparisonOrders,
  discountValue,
  discountType
}) {
  const totalOrders = ordersWithDiscount.length;
  
  // Aggregate metrics from orders
  let totalRevenue = 0;
  let totalCost = 0;
  let totalDiscount = 0;
  
  for (const order of ordersWithDiscount) {
    totalRevenue += parseFloat(order.totalPrice || 0);
    totalDiscount += parseFloat(order.totalDiscount || 0);
    
    // Calculate cost from line items if available
    for (const item of (order.lineItems || [])) {
      const costPerItem = item.costPerItem || 0;
      totalCost += costPerItem * item.quantity;
    }
  }
  
  const totalProfit = totalRevenue - totalCost;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Compare with baseline
  const baselineOrders = comparisonOrders.length;
  let baselineRevenue = 0;
  let baselineCost = 0;
  
  for (const order of comparisonOrders) {
    baselineRevenue += parseFloat(order.totalPrice || 0);
    for (const item of (order.lineItems || [])) {
      const costPerItem = item.costPerItem || 0;
      baselineCost += costPerItem * item.quantity;
    }
  }
  
  const baselineProfit = baselineRevenue - baselineCost;
  const baselineAvgOrderValue = baselineOrders > 0 ? baselineRevenue / baselineOrders : 0;
  
  // Calculate normalized comparison (per order)
  const avgProfitWithDiscount = totalOrders > 0 ? totalProfit / totalOrders : 0;
  const avgProfitWithoutDiscount = baselineOrders > 0 ? baselineProfit / baselineOrders : 0;
  
  // ROI calculation
  const profitDifference = totalProfit - (baselineProfit * (totalOrders / Math.max(baselineOrders, 1)));
  const roiPercentage = totalDiscount > 0 
    ? (profitDifference / totalDiscount) * 100 
    : 0;
  
  const isProfitable = profitDifference > 0;
  
  // Profitability score (0-100)
  let profitabilityScore = 50;
  if (isProfitable) {
    profitabilityScore = Math.min(100, 50 + Math.floor(roiPercentage / 2));
  } else {
    profitabilityScore = Math.max(0, 50 + Math.floor(roiPercentage / 2));
  }
  
  return {
    totalOrders,
    totalRevenue,
    totalCost,
    totalProfit,
    totalDiscount,
    avgOrderValue,
    roiPercentage,
    isProfitable,
    profitabilityScore,
    comparison: {
      baselineOrders,
      baselineRevenue,
      baselineProfit,
      baselineAvgOrderValue,
      avgProfitWithDiscount,
      avgProfitWithoutDiscount,
      profitDifference
    }
  };
}

/**
 * Generate recommendation for a product based on historical performance
 * 
 * @param {Object} params
 * @param {number} params.currentMargin - Current margin percentage
 * @param {number} params.historicalROI - Average ROI from past discounts
 * @param {number} params.priceElasticity - Estimated price elasticity
 * @param {number} params.lastDiscountLevel - Last used discount percentage
 * @returns {Object} Recommendation
 */
export function generateRecommendation({
  currentMargin,
  historicalROI,
  priceElasticity = 1,
  lastDiscountLevel = 0
}) {
  let recommendationType = 'maintain';
  let suggestedDiscountPercent = lastDiscountLevel;
  let confidence = 0.5;
  let reasoning = '';
  
  // High ROI and good elasticity - can increase discount
  if (historicalROI > 50 && priceElasticity > 1.5) {
    recommendationType = 'increase';
    suggestedDiscountPercent = Math.min(lastDiscountLevel + 5, currentMargin * 0.5); // Don't exceed 50% of margin
    confidence = 0.7;
    reasoning = 'Wysoka elastyczność cenowa i pozytywny ROI wskazują na potencjał zwiększenia rabatu.';
  }
  
  // Low ROI - should decrease or avoid discounts
  else if (historicalROI < -20) {
    recommendationType = 'avoid';
    suggestedDiscountPercent = 0;
    confidence = 0.8;
    reasoning = 'Rabaty na ten produkt przynoszą straty. Zalecane unikanie rabatów.';
  }
  
  // Negative but mild ROI - decrease
  else if (historicalROI < 0) {
    recommendationType = 'decrease';
    suggestedDiscountPercent = Math.max(0, lastDiscountLevel - 5);
    confidence = 0.6;
    reasoning = 'Obecny poziom rabatu jest nierentowny. Zalecane zmniejszenie.';
  }
  
  // Moderate positive ROI - maintain
  else if (historicalROI >= 0 && historicalROI <= 50) {
    recommendationType = 'maintain';
    suggestedDiscountPercent = lastDiscountLevel;
    confidence = 0.5;
    reasoning = 'Obecny poziom rabatu jest umiarkowanie opłacalny.';
  }
  
  // Calculate expected ROI based on recommendation
  const expectedROI = recommendationType === 'avoid' 
    ? 0 
    : historicalROI * (1 + (suggestedDiscountPercent - lastDiscountLevel) / 100);
  
  return {
    recommendationType,
    suggestedDiscountPercent,
    expectedRoi: expectedROI,
    confidenceLevel: confidence,
    reasoning,
    reasoningKey: recommendationType // for i18n: increase, decrease, avoid, maintain
  };
}

/**
 * Calculate optimal discount level for a product
 * Based on margin and target ROI
 * 
 * @param {number} margin - Product margin percentage
 * @param {number} elasticity - Price elasticity (estimated)
 * @param {number} targetROI - Target ROI percentage (default 20%)
 * @returns {number} Optimal discount percentage
 */
export function calculateOptimalDiscount(margin, elasticity = 1, targetROI = 20) {
  // Formula: Optimal discount = Margin * (1 - 1/(1 + targetROI/100)) * elasticity_factor
  const elasticityFactor = Math.min(elasticity, 2) / 2; // Normalize elasticity
  const maxSafeDiscount = margin * 0.5; // Don't exceed 50% of margin
  
  const theoreticalOptimal = margin * (1 - 1 / (1 + targetROI / 100)) * elasticityFactor;
  
  return Math.min(theoreticalOptimal, maxSafeDiscount);
}
