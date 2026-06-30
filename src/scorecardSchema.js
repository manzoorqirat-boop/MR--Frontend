// Mirror of the backend ScorecardSchema (Services/ScorecardSchema.cs), generated from
// the standard Monthly Site Scorecard template. Drives the dynamic data-entry forms,
// the analytics column pickers and the on-screen computed-column preview.
// Keep in sync with the backend when adding metrics.

export const SCORECARD_SCHEMA = [
  {
    "key": "humanError",
    "title": "Human Error",
    "category": "Quality & Compliance",
    "multiRow": true,
    "order": 1,
    "columns": [
      {
        "key": "relatedEvents",
        "label": "Related Events",
        "excelCol": 3,
        "type": "text",
        "formula": null
      },
      {
        "key": "noOfEventClosedInTimePeriod",
        "label": "No of Event Closed in Time period",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "rootCauseAsHumanErrror",
        "label": "Root cause as Human Errror",
        "excelCol": 5,
        "type": "number",
        "formula": null
      },
      {
        "key": "ofHumanError",
        "label": "% of Human Error",
        "excelCol": 6,
        "type": "computed",
        "formula": "={rootCauseAsHumanErrror}/{noOfEventClosedInTimePeriod}"
      }
    ],
    "sheetName": "Human Error"
  },
  {
    "key": "oosRate",
    "title": "OOS Rate (%)",
    "category": "Quality & Compliance",
    "multiRow": false,
    "order": 2,
    "columns": [
      {
        "key": "noOfBatchSampleAnalyzedInQcArNo",
        "label": "No of Batch sample analyzed in QC (AR No.)",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfInvalidOosClosedInTimePeriod",
        "label": "No of Invalid OOS Closed in Time period",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfValidOosClosedInTimePeriod",
        "label": "No of valid OOS Closed in Time period",
        "excelCol": 5,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalOosClosed",
        "label": "Total OOS Closed",
        "excelCol": 6,
        "type": "computed",
        "formula": "=SUM({noOfInvalidOosClosedInTimePeriod}:{noOfValidOosClosedInTimePeriod})"
      },
      {
        "key": "invalidOos",
        "label": "% Invalid OOS",
        "excelCol": 7,
        "type": "computed",
        "formula": "={noOfInvalidOosClosedInTimePeriod}/{noOfBatchSampleAnalyzedInQcArNo}"
      },
      {
        "key": "validOos",
        "label": "% valid OOS",
        "excelCol": 8,
        "type": "computed",
        "formula": "={noOfValidOosClosedInTimePeriod}/{noOfBatchSampleAnalyzedInQcArNo}"
      },
      {
        "key": "overallOos",
        "label": "%overall OOS",
        "excelCol": 9,
        "type": "computed",
        "formula": "={totalOosClosed}/{noOfBatchSampleAnalyzedInQcArNo}"
      }
    ],
    "sheetName": "OOS Rate (%)"
  },
  {
    "key": "deviationRate",
    "title": "Deviation Rate",
    "category": "Quality & Compliance",
    "multiRow": false,
    "order": 3,
    "columns": [
      {
        "key": "noOfBatchesMgfPkg",
        "label": "No of Batches (Mgf & Pkg)",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalDeviationReportedInTimePeriod",
        "label": "Total Deviation reported in time period",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "deviation",
        "label": "% Deviation",
        "excelCol": 5,
        "type": "computed",
        "formula": "=SUM({totalDeviationReportedInTimePeriod}/{noOfBatchesMgfPkg})"
      }
    ],
    "sheetName": "Deviation Rate"
  },
  {
    "key": "lir",
    "title": "LIR",
    "category": "Quality & Compliance",
    "multiRow": false,
    "order": 4,
    "columns": [
      {
        "key": "noOfBatchSampleAnalyzedInQcArNo",
        "label": "No of Batch sample analyzed in QC (AR No.)",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfLirReportedAfterSamples",
        "label": "No of LIR reported After Samples",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfLirReportedBeforeSamples",
        "label": "No of LIR reported Before samples",
        "excelCol": 5,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalNoOfLirReportedInTimePeriod",
        "label": "Total No of LIR reported in time period",
        "excelCol": 6,
        "type": "computed",
        "formula": "={noOfLirReportedAfterSamples}+{noOfLirReportedBeforeSamples}"
      },
      {
        "key": "lir",
        "label": "% LIR",
        "excelCol": 7,
        "type": "computed",
        "formula": "=SUM({totalNoOfLirReportedInTimePeriod}/{noOfBatchSampleAnalyzedInQcArNo})"
      }
    ],
    "sheetName": "LIR"
  },
  {
    "key": "repetitiveEvents",
    "title": "Repetitive Events (%)",
    "category": "Quality & Compliance",
    "multiRow": true,
    "order": 5,
    "columns": [
      {
        "key": "events",
        "label": "Events",
        "excelCol": 3,
        "type": "text",
        "formula": null
      },
      {
        "key": "totalNoOfEventClosed",
        "label": "Total no of Event Closed",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfRepetativeEventBasedOnProductForRepe",
        "label": "No of Repetative Event based on product (for repetative nature- follow SOP time period)",
        "excelCol": 5,
        "type": "number",
        "formula": null
      },
      {
        "key": "repetitiveBasedOnProduct",
        "label": "% Repetitive Based on Product",
        "excelCol": 6,
        "type": "computed",
        "formula": "={noOfRepetativeEventBasedOnProductForRepe}/{totalNoOfEventClosed}"
      },
      {
        "key": "noOfRepetativeEventBasedOnSimilarRootCau",
        "label": "No of Repetative Event based on similar Root cause (RCA) in time period (for repetative nature- follow SOP time period)",
        "excelCol": 7,
        "type": "number",
        "formula": null
      },
      {
        "key": "repetitiveBasedOnRca",
        "label": "% Repetitive based on RCA",
        "excelCol": 8,
        "type": "computed",
        "formula": "={noOfRepetativeEventBasedOnSimilarRootCau}/{totalNoOfEventClosed}"
      }
    ],
    "sheetName": "Repetitive Events (%)"
  },
  {
    "key": "hplcOccupancy",
    "title": "HPLC Occupancy (%)",
    "category": "Laboratory Performance",
    "multiRow": false,
    "order": 6,
    "columns": [
      {
        "key": "totalNoOfHplcA",
        "label": "Total no of HPLC (A)",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "actualHplcRunHour",
        "label": "Actual HPLC Run (Hour)",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfWorkingDaysAtSiteByConsideringSiteWo",
        "label": "No of working Days at site (By considering site working for 30 days)",
        "excelCol": 5,
        "type": "number",
        "formula": null
      },
      {
        "key": "standardHrsDay",
        "label": "Standard hrs @ day",
        "excelCol": 6,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalStandardTimeInHour3024A",
        "label": "Total standard Time in (Hour) (30*24*A)",
        "excelCol": 7,
        "type": "computed",
        "formula": "={standardHrsDay}*{noOfWorkingDaysAtSiteByConsideringSiteWo}*{totalNoOfHplcA}"
      },
      {
        "key": "hplcOccupancy",
        "label": "%HPLC Occupancy",
        "excelCol": 8,
        "type": "computed",
        "formula": "={actualHplcRunHour}/{totalStandardTimeInHour3024A}"
      }
    ],
    "sheetName": "HPLC Occupancy (%)"
  },
  {
    "key": "gcOccupancy",
    "title": "GC Occupancy (%)",
    "category": "Laboratory Performance",
    "multiRow": false,
    "order": 7,
    "columns": [
      {
        "key": "totalNoOfGcA",
        "label": "Total no of GC (A)",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "actualGcRunHour",
        "label": "Actual GC Run (Hour)",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfWorkingDaysAtSiteByConsideringSiteWo",
        "label": "No of working Days at site (By considering site working for 30 days)",
        "excelCol": 5,
        "type": "number",
        "formula": null
      },
      {
        "key": "standardHrsDay",
        "label": "Standard hrs @ day",
        "excelCol": 6,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalStandardTimeInHour3024A",
        "label": "Total standard Time in (Hour) (30*24*A)",
        "excelCol": 7,
        "type": "computed",
        "formula": "={standardHrsDay}*{noOfWorkingDaysAtSiteByConsideringSiteWo}*{totalNoOfGcA}"
      },
      {
        "key": "gcOccupancy",
        "label": "%GC Occupancy",
        "excelCol": 8,
        "type": "computed",
        "formula": "={actualGcRunHour}/{totalStandardTimeInHour3024A}"
      }
    ],
    "sheetName": "GC Occupancy (%)"
  },
  {
    "key": "analystEfficiency",
    "title": "Analyst Efficiency",
    "category": "Laboratory Performance",
    "multiRow": false,
    "order": 8,
    "columns": [
      {
        "key": "totalNoOfSampleReceivedForTesting",
        "label": "Total no of sample received for testing",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalNoOfSampleAnalysed",
        "label": "Total no of sample analysed",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalNoOfAnalystInLab",
        "label": "Total no of analyst in LAB",
        "excelCol": 5,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalNoOfWorkingDays",
        "label": "Total no of working days",
        "excelCol": 6,
        "type": "number",
        "formula": null
      },
      {
        "key": "analystEfficiency",
        "label": "% Analyst Efficiency",
        "excelCol": 7,
        "type": "computed",
        "formula": "={totalNoOfSampleAnalysed}/({totalNoOfAnalystInLab}*{totalNoOfWorkingDays})"
      }
    ],
    "sheetName": "Analyst Efficiency"
  },
  {
    "key": "eventExtensionIndex",
    "title": "Event Extension Index",
    "category": "Event & Investigation",
    "multiRow": true,
    "order": 9,
    "columns": [
      {
        "key": "event",
        "label": "Event",
        "excelCol": 3,
        "type": "text",
        "formula": null
      },
      {
        "key": "totalNoOfEventClose",
        "label": "Total no of Event Close",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfEventCloseWithInTime",
        "label": "No of Event Close with in time",
        "excelCol": 5,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfEventCloseWithOverTimelines",
        "label": "No of Event Close with over timelines",
        "excelCol": 6,
        "type": "computed",
        "formula": "={totalNoOfEventClose}-{noOfEventCloseWithInTime}"
      },
      {
        "key": "noOfExtensionInEvent",
        "label": "No of Extension in Event",
        "excelCol": 7,
        "type": "number",
        "formula": null
      },
      {
        "key": "closureWithinSop",
        "label": "Closure Within SOP (%)",
        "excelCol": 8,
        "type": "computed",
        "formula": "=({noOfEventCloseWithInTime}/{totalNoOfEventClose})*100"
      }
    ],
    "sheetName": "Event Extension Index"
  },
  {
    "key": "auditPerformance",
    "title": "Audit Performance",
    "category": "Event & Investigation",
    "multiRow": true,
    "order": 10,
    "columns": [
      {
        "key": "nameOfAuthorityDepartmentAuditors",
        "label": "Name of Authority/ Department (Auditors)",
        "excelCol": 3,
        "type": "text",
        "formula": null
      },
      {
        "key": "typeOfAudit",
        "label": "Type of Audit",
        "excelCol": 4,
        "type": "text",
        "formula": null
      },
      {
        "key": "startDateDdMmmYy",
        "label": "Start Date DD-MMM-YY",
        "excelCol": 5,
        "type": "date",
        "formula": null
      },
      {
        "key": "endDateDdMmmYy",
        "label": "End date DD-MMM-YY",
        "excelCol": 6,
        "type": "date",
        "formula": null
      },
      {
        "key": "reportReceived",
        "label": "Report Received",
        "excelCol": 7,
        "type": "text",
        "formula": null
      },
      {
        "key": "capaComplianceStatus",
        "label": "CAPA / Compliance Status",
        "excelCol": 8,
        "type": "text",
        "formula": null
      },
      {
        "key": "approvalStatus",
        "label": "Approval Status",
        "excelCol": 9,
        "type": "text",
        "formula": null
      },
      {
        "key": "noOfCriticalObservation",
        "label": "No of critical observation",
        "excelCol": 10,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfMajorObservation",
        "label": "No of major observation",
        "excelCol": 11,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfMinorObservation",
        "label": "No of minor observation",
        "excelCol": 12,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalNoOfRepeatedObservationNotedByAgenc",
        "label": "Total no of repeated observation noted by agency/Customer/CQC of that time period",
        "excelCol": 13,
        "type": "number",
        "formula": null
      },
      {
        "key": "remarkIfAny",
        "label": "Remark (If any)",
        "excelCol": 14,
        "type": "text",
        "formula": null
      }
    ],
    "sheetName": "Audit Performance "
  },
  {
    "key": "marketDepotComplaints",
    "title": "Market-Depot Complaints",
    "category": "Market & Product Quality",
    "multiRow": false,
    "order": 11,
    "columns": [
      {
        "key": "noOfBatchesDispatchedOnSameTimePeriod",
        "label": "No. of batches dispatched on same time period",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfMarketCompliantReceivedForProductQua",
        "label": "No of Market compliant received for Product quality defects",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "ofMarketCompalintLogged",
        "label": "% of market compalint logged",
        "excelCol": 5,
        "type": "computed",
        "formula": "={noOfMarketCompliantReceivedForProductQua}/{noOfBatchesDispatchedOnSameTimePeriod}"
      }
    ],
    "sheetName": "Market-Depot Complaints"
  },
  {
    "key": "rightFirstTime",
    "title": "Right-First-Time",
    "category": "Market & Product Quality",
    "multiRow": false,
    "order": 12,
    "columns": [
      {
        "key": "noOfLotsTestedInTheReportingTimeframeB",
        "label": "No. of lots tested in the reporting timeframe (B)",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfBatchesLotRejectedInSameTimePeriod",
        "label": "No. of batches/lot rejected in same time period",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "lotAcceptanceRate",
        "label": "Lot Acceptance Rate (%)",
        "excelCol": 5,
        "type": "computed",
        "formula": "=({noOfLotsTestedInTheReportingTimeframeB}-{noOfBatchesLotRejectedInSameTimePeriod})/{noOfLotsTestedInTheReportingTimeframeB}"
      },
      {
        "key": "noOfBatchesLotReleasedWithoutAnySingleEv",
        "label": "No. of batches/lot released without any single event that OOS/DEV/OOT/LIR in same time period",
        "excelCol": 6,
        "type": "number",
        "formula": null
      },
      {
        "key": "ofRightFirstTime",
        "label": "% of Right first time",
        "excelCol": 7,
        "type": "computed",
        "formula": "={noOfBatchesLotReleasedWithoutAnySingleEv}/{noOfLotsTestedInTheReportingTimeframeB}"
      }
    ],
    "sheetName": "Right-First-Time"
  },
  {
    "key": "training",
    "title": "Training %",
    "category": "Governance & Sustainability",
    "multiRow": false,
    "order": 13,
    "columns": [
      {
        "key": "completionOfSopTraining",
        "label": "% Completion of SOP Training",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "completionOfGmpTraining",
        "label": "% Completion of GMP Training",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "completionOfFuntionalTraining",
        "label": "% Completion of Funtional Training",
        "excelCol": 5,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfExternalTrainingByOem",
        "label": "No of External training (By OEM)",
        "excelCol": 6,
        "type": "number",
        "formula": null
      },
      {
        "key": "nameOfExternalTrainingByAgencySme",
        "label": "Name of External training (by agency/SME)",
        "excelCol": 7,
        "type": "text",
        "formula": null
      }
    ],
    "sheetName": "Training %"
  },
  {
    "key": "lotAcceptanceRateSop019",
    "title": "Lot Acceptance Rate (SOP-019)",
    "category": "Market & Product Quality",
    "multiRow": false,
    "order": 14,
    "columns": [
      {
        "key": "noOfLotsSaleableTestedInTheReportingTime",
        "label": "No. of lots (saleable) tested in the reporting timeframe (B)",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "noOfBatchesLotRejectedInSameTimePeriod",
        "label": "No. of batches/lot rejected in same time period",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "lotAcceptanceRate",
        "label": "Lot Acceptance Rate (%)",
        "excelCol": 5,
        "type": "computed",
        "formula": "=({noOfLotsSaleableTestedInTheReportingTime}-{noOfBatchesLotRejectedInSameTimePeriod})/{noOfLotsSaleableTestedInTheReportingTime}"
      }
    ],
    "sheetName": "Lot Acceptance Rate (SOP-019)"
  },
  {
    "key": "pqcrAsPerSop019",
    "title": "PQCR (As per SOP-019)",
    "category": "Market & Product Quality",
    "multiRow": false,
    "order": 15,
    "columns": [
      {
        "key": "numberOfCustomerComplaintReceivedForAPro",
        "label": "Number of Customer Complaint Received for a Product (No. of Batches) in the reporting timeframe",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalNumberOfBatchesDistributedInTheRepo",
        "label": "Total number of batches distributed in the reporting timeframe",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "acceptanceRate",
        "label": "%Acceptance Rate",
        "excelCol": 5,
        "type": "computed",
        "formula": "={numberOfCustomerComplaintReceivedForAPro}/{totalNumberOfBatchesDistributedInTheRepo}"
      }
    ],
    "sheetName": "PQCR (As per SOP-019) "
  },
  {
    "key": "ioosrAsPerSop019",
    "title": "IOOSR (As per SOP_019)",
    "category": "Market & Product Quality",
    "multiRow": false,
    "order": 16,
    "columns": [
      {
        "key": "numberOfInvalidateOosTestResultsInCommer",
        "label": "Number of invalidate OOS test results (In Commercial Finished Product & Long-term Stability Analysis )",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalNumberOfOosClosedInCommercialFinish",
        "label": "Total number of OOS closed (In Commercial Finished Product & Long-term Stability Analysis)",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "ioosr",
        "label": "% IOOSR",
        "excelCol": 5,
        "type": "computed",
        "formula": "={numberOfInvalidateOosTestResultsInCommer}/{totalNumberOfOosClosedInCommercialFinish}"
      }
    ],
    "sheetName": "IOOSR (As per SOP_019)"
  },
  {
    "key": "pqrcrAsPerSop019",
    "title": "PQRCR (As per SOP-019)",
    "category": "Market & Product Quality",
    "multiRow": false,
    "order": 17,
    "columns": [
      {
        "key": "numberOfApqrCompletedInTheReportingTimef",
        "label": "Number of APQR completed in the reporting timeframe",
        "excelCol": 3,
        "type": "number",
        "formula": null
      },
      {
        "key": "numberOfApqrScheduledInTheReportingTimef",
        "label": "Number of APQR scheduled in the reporting timeframe",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalCompleton",
        "label": "Total completon",
        "excelCol": 5,
        "type": "computed",
        "formula": "={numberOfApqrCompletedInTheReportingTimef}/{numberOfApqrScheduledInTheReportingTimef}"
      }
    ],
    "sheetName": "PQRCR (As per SOP-019)"
  },
  {
    "key": "timeLineCompliance",
    "title": "Time Line compliance",
    "category": "Event & Investigation",
    "multiRow": true,
    "order": 18,
    "columns": [
      {
        "key": "relatedEvents",
        "label": "Related Events",
        "excelCol": 3,
        "type": "text",
        "formula": null
      },
      {
        "key": "numberOfEventClosureWithInSopDefinedTime",
        "label": "Number of event closure with in SOP defined timeline",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "totalNumberEventClosureDone",
        "label": "Total number event closure done",
        "excelCol": 5,
        "type": "number",
        "formula": null
      },
      {
        "key": "compliance",
        "label": "%Compliance",
        "excelCol": 6,
        "type": "computed",
        "formula": "={numberOfEventClosureWithInSopDefinedTime}/{totalNumberEventClosureDone}"
      }
    ],
    "sheetName": "Time Line compliance"
  },
  {
    "key": "equipmentQualification",
    "title": "Equipment Qualification",
    "category": "Qualification/Validation",
    "multiRow": true,
    "order": 19,
    "columns": [
      {
        "key": "typeOfActivities",
        "label": "Type of Activities",
        "excelCol": 3,
        "type": "text",
        "formula": null
      },
      {
        "key": "productSegment",
        "label": "Product Segment",
        "excelCol": 4,
        "type": "text",
        "formula": null
      },
      {
        "key": "noSActivitiesInitiatedReportingMonth",
        "label": "No.'s Activities Initiated (reporting month)",
        "excelCol": 5,
        "type": "text",
        "formula": null
      },
      {
        "key": "carryForwardFromPreviousMonthS",
        "label": "Carry Forward from Previous Month(s)",
        "excelCol": 6,
        "type": "text",
        "formula": null
      },
      {
        "key": "activitiesCompleted",
        "label": "Activities Completed",
        "excelCol": 7,
        "type": "text",
        "formula": null
      },
      {
        "key": "activitiesUProgress",
        "label": "Activities U/Progress",
        "excelCol": 8,
        "type": "text",
        "formula": null
      },
      {
        "key": "remarks",
        "label": "Remarks",
        "excelCol": 9,
        "type": "text",
        "formula": null
      }
    ],
    "sheetName": "Equipment Qualification "
  },
  {
    "key": "manPowerStatus",
    "title": "Man Power status",
    "category": "Manpower",
    "multiRow": true,
    "order": 20,
    "columns": [
      {
        "key": "department",
        "label": "Department",
        "excelCol": 3,
        "type": "text",
        "formula": null
      },
      {
        "key": "budgetedManpower",
        "label": "Budgeted manpower",
        "excelCol": 4,
        "type": "number",
        "formula": null
      },
      {
        "key": "existingManpowerAsOnDate",
        "label": "Existing Manpower as on Date",
        "excelCol": 5,
        "type": "number",
        "formula": null
      },
      {
        "key": "underResignation",
        "label": "Under Resignation",
        "excelCol": 6,
        "type": "number",
        "formula": null
      },
      {
        "key": "leavedOrganization",
        "label": "Leaved organization",
        "excelCol": 7,
        "type": "number",
        "formula": null
      },
      {
        "key": "newJoineeStatus",
        "label": "New Joinee Status",
        "excelCol": 8,
        "type": "number",
        "formula": null
      },
      {
        "key": "remarks",
        "label": "Remarks",
        "excelCol": 9,
        "type": "text",
        "formula": null
      }
    ],
    "sheetName": "Man Power status"
  }
];

export const SCORECARD_CATEGORIES = [...new Set(SCORECARD_SCHEMA.map(m => m.category))];

export function metricByKey(key) {
  return SCORECARD_SCHEMA.find(m => m.key === key) || null;
}

export function inputColumns(metric) {
  return metric ? metric.columns.filter(c => c.type !== 'computed') : [];
}

export function computedColumns(metric) {
  return metric ? metric.columns.filter(c => c.type === 'computed') : [];
}

// ---- Client-side formula engine: live preview of computed cells while typing ----
// Mirrors backend ScorecardFormula.cs. Returns a map columnKey -> number|null.
export function computeRow(metric, raw) {
  const nums = {};
  for (const col of metric.columns) {
    if (col.type === 'number') {
      const v = raw[col.key];
      const n = v === '' || v === undefined || v === null ? null : Number(v);
      nums[col.key] = Number.isFinite(n) ? n : null;
    }
  }
  for (const col of metric.columns) {
    if (col.type === 'computed') nums[col.key] = evalFormula(col.formula, nums);
  }
  return nums;
}

function evalFormula(formula, values) {
  if (!formula) return null;
  let expr = formula.replace(/^=/, '').trim();
  expr = expr.replace(/SUM\(([^)]*)\)/gi, (_, inner) =>
    '(' + inner.split(/[:+,]/).map(s => s.trim()).join('+') + ')');
  let missing = false;
  expr = expr.replace(/\{([A-Za-z0-9_]+)\}/g, (_, key) => {
    const v = values[key];
    if (v === null || v === undefined) { missing = true; return '0'; }
    return String(v);
  });
  if (missing) return null;
  if (!/^[0-9eE+\-*/(). ]+$/.test(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const val = Function('"use strict";return (' + expr + ')')();
    if (!Number.isFinite(val)) return null;
    return Math.round(val * 10000) / 10000;
  } catch {
    return null;
  }
}

export function formatCell(value) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}
