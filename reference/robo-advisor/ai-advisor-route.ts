import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

type AiAdvisorRequest = {
  availableCashTwd: number;
  allocationGaps: Array<{
    assetClass: string;
    targetWeight: number;
    currentWeight: number;
    gapWeight: number;
  }>;
  goals: Array<{
    label: string;
    requiredMonthly: number;
    status: "on_track" | "behind" | "funded";
  }>;
  technicals: Array<{
    ticker: string;
    price: number;
    rsi14: number | null;
    stochasticK: number | null;
    stochasticD: number | null;
    macdHistogram: number | null;
    marketTemperature: number | null;
  }>;
  backtest: {
    cagr: number;
    maxDrawdown: number;
    sharpeRatio: number;
    bestYear: number;
    worstYear: number;
  };
  recommendationDraft: {
    targetAllocation: string;
    rebalanceAlert: boolean;
    suggestedTrades: Array<{
      ticker: string;
      quantity: number;
      estimatedCostTwd: number;
      reason: string;
    }>;
  };
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

function buildSystemInstruction(payload: AiAdvisorRequest) {
  return `
You are a household portfolio explainer that follows Bogleheads principles strictly.

Non-negotiable rules:
- Prefer low-cost diversified index ETFs.
- Never recommend leverage, options, individual stock bets, day trading, or market timing.
- Technical indicators are secondary and may only fine-tune the order of purchases within the existing stock/bond policy.
- If technicals conflict with long-term allocation needs, the allocation need wins.
- Use only the numbers provided by the caller. If data is missing, say it is missing.
- Do not fabricate returns, probabilities, or future prices.

Portfolio policy context:
- Cash available this month: ${payload.availableCashTwd.toLocaleString()} TWD
- Target allocation: ${payload.recommendationDraft.targetAllocation}
- Rebalance alert: ${payload.recommendationDraft.rebalanceAlert ? "YES" : "NO"}

Backtest facts:
- CAGR: ${(payload.backtest.cagr * 100).toFixed(2)}%
- Max drawdown: ${(payload.backtest.maxDrawdown * 100).toFixed(2)}%
- Sharpe ratio: ${payload.backtest.sharpeRatio.toFixed(2)}
- Best year: ${(payload.backtest.bestYear * 100).toFixed(2)}%
- Worst year: ${(payload.backtest.worstYear * 100).toFixed(2)}%

Response requirements:
- Keep the tone calm and factual.
- Explain why the recommendation is aligned with staying invested.
- Mention any goal that is behind schedule.
- Mention technicals only as a footnote, not the main decision rule.
- End with a short, concrete purchase summary.
`.trim();
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as AiAdvisorRequest;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: JSON.stringify(
                {
                  availableCashTwd: payload.availableCashTwd,
                  allocationGaps: payload.allocationGaps,
                  goals: payload.goals,
                  technicals: payload.technicals,
                  backtest: payload.backtest,
                  suggestedTrades: payload.recommendationDraft.suggestedTrades,
                },
                null,
                2,
              ),
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        topP: 0.9,
        systemInstruction: buildSystemInstruction(payload),
      },
    });

    return NextResponse.json({
      summary: response.text,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "ai_advisor_failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
