import React, { useState, useCallback } from "react";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  Alert,
  Container,
  Chip,
  Divider,
  Tooltip,
  Link,
} from "@mui/material";
import {
  Image as ImageIcon,
  CheckCircle,
  Error,
  Upload,
  InfoOutlined,
  WarningAmber,
  ArticleOutlined,
  MedicalServices,
} from "@mui/icons-material";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, ChartTooltip, Legend);

// Custom styled components
const DropzonePaper = ({ children, ...props }) => (
  <Paper
    {...props}
    sx={{
      p: 4,
      border: "2px dashed",
      borderColor: "primary.main",
      borderRadius: 3,
      textAlign: "center",
      cursor: "pointer",
      height: 350,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      bgcolor: "background.paper",
      boxShadow: 2,
      transition: "all 0.3s ease-in-out",
      "&:hover": {
        borderColor: "primary.dark",
        backgroundColor: "action.hover",
      },
    }}
  >
    {children}
  </Paper>
);

const ResultCard = ({ children }) => (
  <Card
    sx={{
      height: "100%",
      boxShadow: 5,
      borderRadius: 3,
      bgcolor: "background.paper",
      overflow: "hidden",
    }}
  >
    <CardContent sx={{ p: 4 }}>{children}</CardContent>
  </Card>
);

// Helper function to determine DR severity grade description
const getDRGradeDescription = (grade) => {
  const descriptions = {
    0: "No DR detected",
    1: "Mild Non-proliferative DR",
    2: "Moderate Non-proliferative DR",
    3: "Severe Non-proliferative DR",
    4: "Proliferative DR",
  };
  return descriptions[grade] || "";
};

// Helper function to get color based on DR severity
const getSeverityColor = (grade) => {
  const colors = {
    0: "#4CAF50", // Green for No DR
    1: "#8BC34A", // Light green for Mild
    2: "#FFC107", // Yellow for Moderate
    3: "#FF9800", // Orange for Severe
    4: "#F44336", // Red for Proliferative
  };
  return colors[grade] || "#4CAF50";
};

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    setError(null);
    setResult(null);
    const selectedFile = acceptedFiles[0];

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB)");
      return;
    }

    if (!["image/jpeg", "image/png"].includes(selectedFile.type)) {
      setError("Only JPEG/PNG images are supported");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(selectedFile);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpeg", ".jpg"],
      "image/png": [".png"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  });

  const predictImage = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        "http://localhost:8000/predict",
        formData
      );
      setResult(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Failed to classify image. Please upload a valid retinal scan."
      );
    } finally {
      setLoading(false);
    }
  };

  // Determine DR grade from highest probability
  const determineDRGrade = (result) => {
    if (!result) return null;

    // Find index of highest probability
    const maxIndex = result.probabilities.indexOf(
      Math.max(...result.probabilities)
    );
    // Extract the grade number from class name (assuming format like "Grade 0", "Grade 1", etc.)
    const gradeNumber = result.class_names[maxIndex].includes("Grade")
      ? result.class_names[maxIndex].split(" ")[1]
      : maxIndex.toString();

    return {
      grade: gradeNumber,
      description: getDRGradeDescription(gradeNumber),
      color: getSeverityColor(gradeNumber),
    };
  };

  const drGrade = result ? determineDRGrade(result) : null;

  const probabilityChartData = result
    ? {
        labels: result.class_names,
        datasets: [
          {
            data: result.probabilities,
            backgroundColor: result.class_names.map((name, idx) => {
              // Extract grade number if possible
              const gradeMatch = name.match(/Grade (\d)/);
              const grade = gradeMatch ? gradeMatch[1] : idx.toString();
              return getSeverityColor(grade);
            }),
            borderWidth: 1,
          },
        ],
      }
    : null;

  return (
    <Box sx={{ bgcolor: "#f1f4f9", minHeight: "100vh", py: 6 }}>
      <Container maxWidth="lg">
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            mb: 1,
            fontWeight: "bold",
            color: "primary.main",
            textAlign: "center",
          }}
        >
          Diabetic Retinopathy Classifier
        </Typography>

        <Typography
          variant="subtitle1"
          sx={{ mb: 4, textAlign: "center", color: "text.secondary" }}
        >
          Upload a retinal fundus image to detect DR severity grade (0-4)
        </Typography>

        <Grid container spacing={4} alignItems="stretch">
          <Grid item xs={12} md={6}>
            <DropzonePaper {...getRootProps()} isDragActive={isDragActive}>
              <input {...getInputProps()} />
              {preview ? (
                <Box sx={{ textAlign: "center" }}>
                  <img
                    src={preview}
                    alt="Preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 250,
                      borderRadius: 8,
                      boxShadow: "0 0 10px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Typography sx={{ mt: 2, fontWeight: 500 }}>
                    {file.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 1, color: "text.secondary" }}
                  >
                    Click to upload a different image
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Upload
                    sx={{
                      fontSize: 60,
                      color: isDragActive ? "primary.dark" : "primary.main",
                      mb: 2,
                    }}
                  />
                  <Typography variant="h6">
                    {isDragActive
                      ? "Drop the image here"
                      : "Upload Retinal Image"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Drag & drop or click to browse
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ mt: 2, display: "block", color: "text.disabled" }}
                  >
                    Supported: JPEG, PNG (Max 5MB)
                  </Typography>
                </Box>
              )}
            </DropzonePaper>

            {file && !loading && (
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={predictImage}
                sx={{
                  mt: 3,
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: "bold",
                  boxShadow: 3,
                }}
              >
                Analyze Image
              </Button>
            )}

            {loading && (
              <Box sx={{ mt: 3 }}>
                <LinearProgress sx={{ height: 8, borderRadius: 5 }} />
                <Typography
                  variant="body2"
                  align="center"
                  sx={{ mt: 1, color: "text.secondary" }}
                >
                  Analyzing retinal image...
                </Typography>
              </Box>
            )}

            {error && (
              <Alert
                severity="error"
                sx={{ mt: 3, borderRadius: 2 }}
                icon={<Error fontSize="large" />}
              >
                <Typography variant="body1" fontWeight={500}>
                  {error}
                </Typography>
              </Alert>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            {result ? (
              <ResultCard>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    mb: 3,
                  }}
                >
                  <Typography variant="h5" sx={{ mb: 1, textAlign: "center" }}>
                    Analysis Result
                  </Typography>

                  <Chip
                    icon={<CheckCircle />}
                    label={`Grade ${drGrade.grade}: ${drGrade.description}`}
                    sx={{
                      fontSize: "1.1rem",
                      py: 3,
                      px: 2,
                      mt: 2,
                      backgroundColor: drGrade.color,
                      color: "white",
                      fontWeight: "bold",
                    }}
                  />

                  <Typography
                    variant="subtitle1"
                    sx={{ mt: 2, color: "text.secondary", textAlign: "center" }}
                  >
                    Confidence: {(result.confidence * 100).toFixed(2)}%
                  </Typography>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" fontWeight="medium" gutterBottom>
                    Probability Distribution
                  </Typography>
                  <Box sx={{ height: 240 }}>
                    <Doughnut
                      data={probabilityChartData}
                      options={{
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: "right",
                            labels: {
                              padding: 20,
                              usePointStyle: true,
                              pointStyle: "circle",
                              font: {
                                size: 11,
                              },
                            },
                          },
                        },
                        cutout: "65%",
                      }}
                    />
                  </Box>
                </Box>

                <Typography
                  variant="h6"
                  fontWeight="medium"
                  gutterBottom
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  DR Grades Probability
                  <Tooltip title="Higher percentage indicates greater likelihood of that DR grade">
                    <InfoOutlined
                      sx={{ ml: 1, fontSize: 18, color: "text.secondary" }}
                    />
                  </Tooltip>
                </Typography>

                {result.probabilities.map((prob, idx) => {
                  // Extract grade number if possible
                  const gradeMatch =
                    result.class_names[idx].match(/Grade (\d)/);
                  const grade = gradeMatch ? gradeMatch[1] : idx.toString();
                  const color = getSeverityColor(grade);

                  return (
                    <Box key={idx} sx={{ mb: 2 }}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          mb: 0.5,
                          alignItems: "center",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              backgroundColor: color,
                              mr: 1,
                            }}
                          />
                          <Typography
                            fontWeight={
                              prob === Math.max(...result.probabilities)
                                ? "bold"
                                : "normal"
                            }
                          >
                            {result.class_names[idx]}{" "}
                            {prob === Math.max(...result.probabilities) && "★"}
                          </Typography>
                        </Box>
                        <Typography
                          fontWeight={
                            prob === Math.max(...result.probabilities)
                              ? "bold"
                              : "medium"
                          }
                        >
                          {(prob * 100).toFixed(2)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={prob * 100}
                        sx={{
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: "grey.200",
                          "& .MuiLinearProgress-bar": {
                            borderRadius: 5,
                            backgroundColor: color,
                          },
                        }}
                      />
                    </Box>
                  );
                })}

                <Divider sx={{ my: 3 }} />

                <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                  <Typography variant="body2">
                    <strong>DR Grade Scale:</strong> 0 (No DR) to 4
                    (Proliferative DR). Higher grades indicate more severe
                    diabetic retinopathy.
                  </Typography>
                </Alert>

                {drGrade && (
                  <Box
                    sx={{
                      mt: 3,
                      p: 3,
                      backgroundColor: "#f8f9fa",
                      borderRadius: 2,
                      border: "1px solid #e0e0e0",
                    }}
                  >
                    <Typography
                      variant="h6"
                      gutterBottom
                      sx={{ color: drGrade.color, fontWeight: "bold" }}
                    >
                      Grade {drGrade.grade}: {drGrade.description}
                    </Typography>

                    <Typography variant="body2" paragraph>
                      {drGrade.grade === "0" &&
                        "No visible signs of diabetic retinopathy detected. Regular annual screening is recommended to monitor for any changes."}
                      {drGrade.grade === "1" &&
                        "Mild non-proliferative diabetic retinopathy (NPDR) shows minimal vascular changes. At this early stage, there are small areas of balloon-like swelling in the retina's blood vessels called microaneurysms."}
                      {drGrade.grade === "2" &&
                        "Moderate non-proliferative diabetic retinopathy shows progression with increased microaneurysms, dot and blot hemorrhages, and hard exudates. Some blood vessels that nourish the retina are blocked."}
                      {drGrade.grade === "3" &&
                        "Severe non-proliferative diabetic retinopathy is characterized by many blocked blood vessels, depriving several areas of the retina of blood supply. These areas secrete growth factors that signal the retina to grow new blood vessels."}
                      {drGrade.grade === "4" &&
                        "Proliferative diabetic retinopathy (PDR) is advanced and very serious. New abnormal blood vessels grow in the retina and into the vitreous humor. These vessels can leak, causing severe vision loss and even blindness."}
                    </Typography>

                    <Typography
                      variant="subtitle2"
                      gutterBottom
                      sx={{ mt: 2, fontWeight: "bold" }}
                    >
                      Clinical Significance:
                    </Typography>
                    <Typography variant="body2" paragraph>
                      {drGrade.grade === "0" &&
                        "Low risk. Continue with regular monitoring. Maintain good blood sugar control and follow healthy lifestyle practices."}
                      {drGrade.grade === "1" &&
                        "Low risk for vision loss. Control blood sugar, blood pressure, and cholesterol. Follow-up examination in 9-12 months is recommended."}
                      {drGrade.grade === "2" &&
                        "Moderate risk. More careful control of diabetes is needed. Patients should be monitored more frequently, typically every 6-8 months."}
                      {drGrade.grade === "3" &&
                        "High risk for progression to PDR. Close monitoring every 3-4 months is essential. Consultation with a retina specialist is recommended."}
                      {drGrade.grade === "4" &&
                        "Very high risk for severe vision loss. Immediate consultation with a retina specialist is required. Treatments may include laser photocoagulation, anti-VEGF injections, or vitrectomy."}
                    </Typography>

                    <Typography
                      variant="subtitle2"
                      gutterBottom
                      sx={{ fontWeight: "bold" }}
                    >
                      References:
                    </Typography>
                    <Typography variant="body2">
                      • American Academy of Ophthalmology. (2022). Diabetic
                      Retinopathy Preferred Practice Pattern.
                    </Typography>
                    <Typography variant="body2">
                      • Wilkinson, C. P., et al. (2003). Proposed international
                      clinical diabetic retinopathy and diabetic macular edema
                      disease severity scales. Ophthalmology, 110(9), 1677-1682.
                    </Typography>
                    <Typography variant="body2">
                      • Wong, T. Y., et al. (2016). Diabetic retinopathy: global
                      prevalence, major risk factors, screening practices and
                      public health challenges. Nature Reviews Endocrinology,
                      12(11), 639-649.
                    </Typography>

                    <Box
                      sx={{ display: "flex", justifyContent: "center", mt: 2 }}
                    >
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<InfoOutlined />}
                        target="_blank"
                        href="https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/diabetic-retinopathy"
                        sx={{
                          borderColor: drGrade.color,
                          color: drGrade.color,
                          "&:hover": {
                            borderColor: drGrade.color,
                            backgroundColor: `${drGrade.color}10`,
                          },
                        }}
                      >
                        Learn More About Diabetic Retinopathy
                      </Button>
                    </Box>
                  </Box>
                )}
              </ResultCard>
            ) : (
              <Paper
                sx={{
                  p: 4,
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  borderRadius: 3,
                  boxShadow: 2,
                  backgroundColor: "#ffffffcc",
                }}
              >
                <ImageIcon
                  sx={{ fontSize: 60, color: "action.disabled", mb: 2 }}
                />
                <Typography variant="h6" color="text.disabled">
                  Analysis Results
                </Typography>
                <Typography
                  variant="body2"
                  color="text.disabled"
                  sx={{ mt: 1 }}
                >
                  Upload a retinal fundus image to see the DR classification
                  results
                </Typography>

                <Box
                  sx={{
                    mt: 4,
                    p: 2,
                    bgcolor: "background.default",
                    borderRadius: 2,
                    width: "100%",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Diabetic Retinopathy Grades:
                  </Typography>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    {[0, 1, 2, 3, 4].map((grade) => (
                      <Box
                        key={grade}
                        sx={{ display: "flex", alignItems: "center" }}
                      >
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            backgroundColor: getSeverityColor(grade.toString()),
                            mr: 1,
                          }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          <strong>Grade {grade}:</strong>{" "}
                          {getDRGradeDescription(grade.toString())}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Paper>
            )}
          </Grid>
        </Grid>

        <Box
          sx={{
            mt: 6,
            pt: 4,
            textAlign: "center",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            This tool is designed specifically for retinal fundus images.
            Results may be inaccurate for other image types.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            For diagnostic purposes only. Please consult with a healthcare
            professional for medical advice.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default App;
