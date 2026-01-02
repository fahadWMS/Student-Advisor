/**
 * Calculator Tool
 * GPA calculations, grade conversions, and academic metrics
 */

import {
  Tool,
  ToolContext,
  ToolResult,
  CalculatorParams,
  GpaResult,
  GradeConversionResult,
} from "./types";

/**
 * Grade scale mapping
 * Supports multiple grading systems
 */
const GRADE_SCALES = {
  "4.0": {
    "A+": { min: 97, max: 100, points: 4.0 },
    A: { min: 93, max: 96, points: 4.0 },
    "A-": { min: 90, max: 92, points: 3.7 },
    "B+": { min: 87, max: 89, points: 3.3 },
    B: { min: 83, max: 86, points: 3.0 },
    "B-": { min: 80, max: 82, points: 2.7 },
    "C+": { min: 77, max: 79, points: 2.3 },
    C: { min: 73, max: 76, points: 2.0 },
    "C-": { min: 70, max: 72, points: 1.7 },
    "D+": { min: 67, max: 69, points: 1.3 },
    D: { min: 63, max: 66, points: 1.0 },
    "D-": { min: 60, max: 62, points: 0.7 },
    F: { min: 0, max: 59, points: 0.0 },
  },
  "5.0": {
    // Weighted scale (for AP/Honors)
    "A+": { min: 97, max: 100, points: 5.0 },
    A: { min: 93, max: 96, points: 5.0 },
    "A-": { min: 90, max: 92, points: 4.7 },
    "B+": { min: 87, max: 89, points: 4.3 },
    B: { min: 83, max: 86, points: 4.0 },
    "B-": { min: 80, max: 82, points: 3.7 },
    "C+": { min: 77, max: 79, points: 3.3 },
    C: { min: 73, max: 76, points: 3.0 },
    "C-": { min: 70, max: 72, points: 2.7 },
    "D+": { min: 67, max: 69, points: 2.3 },
    D: { min: 63, max: 66, points: 2.0 },
    "D-": { min: 60, max: 62, points: 1.7 },
    F: { min: 0, max: 59, points: 0.0 },
  },
};

/**
 * Calculate GPA from courses
 */
function calculateGpa(
  params: {
    courses: Array<{
      name: string;
      grade: string | number; // Letter grade or percentage
      credits: number;
      weighted?: boolean; // For AP/Honors courses
    }>;
    scale?: "4.0" | "5.0";
  },
  context: ToolContext
): ToolResult {
  const startTime = Date.now();

  try {
    const { courses, scale = "4.0" } = params;

    if (!courses || courses.length === 0) {
      return {
        success: false,
        error: "No courses provided",
      };
    }

    let totalPoints = 0;
    let totalCredits = 0;
    const processedCourses: GpaResult["courses"] = [];

    for (const course of courses) {
      // Determine grade scale
      const courseScale = course.weighted && scale === "4.0" ? "5.0" : scale;
      const gradeScale = GRADE_SCALES[courseScale];

      let gradePoints: number;

      // Convert grade to points
      if (typeof course.grade === "number") {
        // Percentage to grade points
        const letterGrade = percentageToLetterGrade(course.grade, gradeScale);
        gradePoints = letterGrade.gpaPoints || 0;
      } else {
        // Letter grade to points
        const gradeInfo = gradeScale[course.grade.toUpperCase() as keyof typeof gradeScale];
        if (!gradeInfo) {
          return {
            success: false,
            error: `Invalid grade: ${course.grade}`,
          };
        }
        gradePoints = gradeInfo.points;
      }

      // Calculate weighted points
      const weightedPoints = gradePoints * course.credits;
      totalPoints += weightedPoints;
      totalCredits += course.credits;

      processedCourses.push({
        name: course.name,
        grade: course.grade.toString(),
        credits: course.credits,
        points: gradePoints,
      });
    }

    const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;

    const result: GpaResult = {
      gpa: Math.round(gpa * 100) / 100, // Round to 2 decimal places
      scale: scale === "4.0" ? 4.0 : 5.0,
      totalCredits,
      courses: processedCourses,
    };

    console.log(`📊 GPA Calculated: ${result.gpa} (${totalCredits} credits)`);

    return {
      success: true,
      data: result,
      metadata: {
        latency: Date.now() - startTime,
        courseCount: courses.length,
      },
    };
  } catch (error) {
    console.error("GPA calculation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      metadata: {
        latency: Date.now() - startTime,
      },
    };
  }
}

/**
 * Convert grade between formats
 */
function convertGrade(
  params: {
    grade: string | number; // Input grade
    fromFormat: "letter" | "percentage" | "gpa";
    toFormat: "letter" | "percentage" | "gpa";
    scale?: "4.0" | "5.0";
  },
  context: ToolContext
): ToolResult {
  const startTime = Date.now();

  try {
    const { grade, fromFormat, toFormat, scale = "4.0" } = params;
    const gradeScale = GRADE_SCALES[scale];

    let result: GradeConversionResult;

    if (fromFormat === "percentage") {
      const percentage = typeof grade === "number" ? grade : parseFloat(grade as string);
      const conversion = percentageToLetterGrade(percentage, gradeScale);
      result = conversion;
    } else if (fromFormat === "letter") {
      const letterGrade = (grade as string).toUpperCase();
      const gradeInfo = gradeScale[letterGrade as keyof typeof gradeScale];

      if (!gradeInfo) {
        return {
          success: false,
          error: `Invalid letter grade: ${letterGrade}`,
        };
      }

      result = {
        percentage: Math.round((gradeInfo.min + gradeInfo.max) / 2), // Midpoint
        letterGrade,
        gpaPoints: gradeInfo.points,
        scale,
      };
    } else if (fromFormat === "gpa") {
      const gpaPoints = typeof grade === "number" ? grade : parseFloat(grade as string);

      // Find closest matching grade
      let closestGrade = "F";
      let closestDiff = Infinity;

      for (const [letter, info] of Object.entries(gradeScale)) {
        const diff = Math.abs(info.points - gpaPoints);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestGrade = letter;
        }
      }

      const gradeInfo = gradeScale[closestGrade as keyof typeof gradeScale];
      result = {
        percentage: Math.round((gradeInfo.min + gradeInfo.max) / 2),
        letterGrade: closestGrade,
        gpaPoints: gradeInfo.points,
        scale,
      };
    } else {
      return {
        success: false,
        error: `Invalid fromFormat: ${fromFormat}`,
      };
    }

    console.log(`🔄 Grade Conversion: ${grade} (${fromFormat}) → ${result.letterGrade} / ${result.percentage}% / ${result.gpaPoints} GPA`);

    return {
      success: true,
      data: result,
      metadata: {
        latency: Date.now() - startTime,
        conversion: `${fromFormat} → ${toFormat}`,
      },
    };
  } catch (error) {
    console.error("Grade conversion error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      metadata: {
        latency: Date.now() - startTime,
      },
    };
  }
}

/**
 * Calculate credits needed for target GPA
 */
function calculateCreditsNeeded(
  params: {
    currentGpa: number;
    currentCredits: number;
    targetGpa: number;
    targetGrade: number; // Expected grade points in new courses
    scale?: "4.0" | "5.0";
  },
  context: ToolContext
): ToolResult {
  const startTime = Date.now();

  try {
    const { currentGpa, currentCredits, targetGpa, targetGrade, scale = "4.0" } = params;

    // Validate inputs
    const maxScale = scale === "5.0" ? 5.0 : 4.0;

    if (currentGpa < 0 || currentGpa > maxScale) {
      return {
        success: false,
        error: `Current GPA must be between 0 and ${maxScale}`,
      };
    }

    if (targetGpa < 0 || targetGpa > maxScale) {
      return {
        success: false,
        error: `Target GPA must be between 0 and ${maxScale}`,
      };
    }

    if (targetGrade < 0 || targetGrade > maxScale) {
      return {
        success: false,
        error: `Target grade must be between 0 and ${maxScale}`,
      };
    }

    // Calculate current total points
    const currentPoints = currentGpa * currentCredits;

    // Calculate required total points for target GPA
    // targetGpa = (currentPoints + creditsNeeded * targetGrade) / (currentCredits + creditsNeeded)
    // Solve for creditsNeeded:
    // creditsNeeded = (targetGpa * currentCredits - currentPoints) / (targetGrade - targetGpa)

    const numerator = targetGpa * currentCredits - currentPoints;
    const denominator = targetGrade - targetGpa;

    if (Math.abs(denominator) < 0.001) {
      return {
        success: false,
        error: "Target grade and target GPA are too close. Calculation not possible.",
      };
    }

    const creditsNeeded = numerator / denominator;

    // Check feasibility
    if (creditsNeeded < 0) {
      return {
        success: true,
        data: {
          creditsNeeded: 0,
          feasible: true,
          message: "Target GPA already achieved or achievable with current credits",
          currentGpa,
          targetGpa,
        },
        metadata: {
          latency: Date.now() - startTime,
        },
      };
    }

    if (creditsNeeded > 200) {
      return {
        success: true,
        data: {
          creditsNeeded: Math.ceil(creditsNeeded),
          feasible: false,
          message: "Target GPA may not be achievable with realistic credit hours",
          currentGpa,
          targetGpa,
        },
        metadata: {
          latency: Date.now() - startTime,
        },
      };
    }

    console.log(`📈 Credits Needed: ${Math.ceil(creditsNeeded)} credits (${currentGpa} → ${targetGpa})`);

    return {
      success: true,
      data: {
        creditsNeeded: Math.ceil(creditsNeeded),
        feasible: true,
        message: `You need approximately ${Math.ceil(creditsNeeded)} credits with an average grade of ${targetGrade.toFixed(2)} to reach a GPA of ${targetGpa}`,
        currentGpa,
        targetGpa,
        expectedGrade: targetGrade,
      },
      metadata: {
        latency: Date.now() - startTime,
      },
    };
  } catch (error) {
    console.error("Credits calculation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      metadata: {
        latency: Date.now() - startTime,
      },
    };
  }
}

/**
 * Helper: Convert percentage to letter grade
 */
function percentageToLetterGrade(
  percentage: number,
  gradeScale: any
): GradeConversionResult {
  for (const [letter, info] of Object.entries(gradeScale)) {
    const gradeInfo = info as { min: number; max: number; points: number };
    if (percentage >= gradeInfo.min && percentage <= gradeInfo.max) {
      return {
        percentage,
        letterGrade: letter,
        gpaPoints: gradeInfo.points,
        scale: gradeScale === GRADE_SCALES["5.0"] ? "5.0" : "4.0",
      };
    }
  }

  // Default to F
  return {
    percentage,
    letterGrade: "F",
    gpaPoints: 0.0,
    scale: "4.0",
  };
}

/**
 * Main calculator execute function
 */
async function executeCalculator(
  params: Record<string, any>,
  context: ToolContext
): Promise<ToolResult> {
  const { operation, data } = params as CalculatorParams;

  switch (operation) {
    case "gpa":
      return calculateGpa(data as any, context);

    case "grade-conversion":
      return convertGrade(data as any, context);

    case "credits-needed":
      return calculateCreditsNeeded(data as any, context);

    default:
      return {
        success: false,
        error: `Unknown operation: ${operation}`,
      };
  }
}

/**
 * Calculator Tool Definition
 */
export const calculatorTool: Tool = {
  name: "calculator",
  description:
    "Calculate GPA, convert grades between formats, and determine credits needed for target GPA. Supports standard 4.0 and weighted 5.0 scales.",
  capabilities: ["calculation", "gpa", "grades"],
  personas: ["academic"],
  parameters: {
    operation: {
      type: "string",
      description: "Type of calculation to perform",
      required: true,
      enum: ["gpa", "grade-conversion", "credits-needed"],
    },
    data: {
      type: "object",
      description: "Input data for the calculation (structure varies by operation)",
      required: true,
    },
  },
  execute: executeCalculator,
  validate: (params: Record<string, any>) => {
    const errors: string[] = [];

    if (!params.operation) {
      errors.push("operation is required");
    }

    if (!["gpa", "grade-conversion", "credits-needed"].includes(params.operation)) {
      errors.push("operation must be one of: gpa, grade-conversion, credits-needed");
    }

    if (!params.data || typeof params.data !== "object") {
      errors.push("data must be an object");
    }

    // Operation-specific validation
    if (params.operation === "gpa") {
      if (!params.data.courses || !Array.isArray(params.data.courses)) {
        errors.push("data.courses must be an array for gpa operation");
      }
    }

    if (params.operation === "grade-conversion") {
      if (!params.data.grade) {
        errors.push("data.grade is required for grade-conversion");
      }
      if (!params.data.fromFormat || !params.data.toFormat) {
        errors.push("data.fromFormat and data.toFormat are required");
      }
    }

    if (params.operation === "credits-needed") {
      if (
        params.data.currentGpa === undefined ||
        params.data.currentCredits === undefined ||
        params.data.targetGpa === undefined ||
        params.data.targetGrade === undefined
      ) {
        errors.push(
          "data.currentGpa, data.currentCredits, data.targetGpa, and data.targetGrade are required"
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
  examples: [
    {
      description: "Calculate GPA from courses",
      params: {
        operation: "gpa",
        data: {
          courses: [
            { name: "Calculus I", grade: "A", credits: 4 },
            { name: "Physics", grade: "B+", credits: 3 },
            { name: "English", grade: 92, credits: 3 },
          ],
          scale: "4.0",
        },
      },
    },
    {
      description: "Convert percentage to letter grade",
      params: {
        operation: "grade-conversion",
        data: {
          grade: 87,
          fromFormat: "percentage",
          toFormat: "letter",
          scale: "4.0",
        },
      },
    },
    {
      description: "Calculate credits needed for 3.5 GPA",
      params: {
        operation: "credits-needed",
        data: {
          currentGpa: 3.2,
          currentCredits: 60,
          targetGpa: 3.5,
          targetGrade: 3.7,
          scale: "4.0",
        },
      },
    },
  ],
};

export default calculatorTool;
