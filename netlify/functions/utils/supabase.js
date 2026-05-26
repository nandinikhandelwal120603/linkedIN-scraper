import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

const DEFAULT_PROFILE_MODES = {
  genai: {
    summary: "Expert in GenAI, Large Language Models, Prompt Engineering, LangChain, RAG.",
    skills: ["Python", "LangChain", "OpenAI API", "Hugging Face", "Vector DBs", "RAG"],
    key_projects: [
      {
        title: "LLM Customer Support Agent",
        description: "Built an automated SQL agent for customer support query routing.",
        impact: "Reduced response latency by 45% and improved resolution rate to 92%."
      }
    ],
    signals: ["Actively building LLM systems", "Passionate about agentic workflows"]
  },
  aiml: {
    summary: "Machine Learning Engineer with focus on PyTorch, model optimization, and training pipelines.",
    skills: ["Python", "PyTorch", "TensorFlow", "Scikit-Learn", "Model Fine-tuning", "Kubeflow"],
    key_projects: [
      {
        title: "Predictive Maintenance Pipeline",
        description: "Developed and deployed anomaly detection models for industrial sensors.",
        impact: "Saved over $150k in hardware downtime across client sites."
      }
    ],
    signals: ["Strong mathematical foundations", "Model optimization enthusiast"]
  },
  cv: {
    summary: "Computer Vision specialist focusing on object detection, segmentation, and YOLO architectures.",
    skills: ["C++", "Python", "OpenCV", "YOLO", "PyTorch Vision", "CUDA"],
    key_projects: [
      {
        title: "Real-time Traffic Monitoring System",
        description: "Designed object detection pipeline for city traffic management APIs.",
        impact: "Monitored 10,000+ daily vehicles with 98.4% detection accuracy."
      }
    ],
    signals: ["Deep understanding of spatial networks", "Optimizing edge vision models"]
  },
  robotics: {
    summary: "Robotics developer with ROS and kinematics simulation experience.",
    skills: ["C++", "Python", "ROS 2", "MoveIt", "Gazebo", "Kinematics"],
    key_projects: [
      {
        title: "Autonomous Warehouse Picker",
        description: "Implemented path planning algorithms for mobile robotic arm bases.",
        impact: "Decreased pick cycle time by 20% in simulated warehouse environments."
      }
    ],
    signals: ["Fascinated by mechanical-software intersections", "ROS expert"]
  },
  automation: {
    summary: "Automation Specialist building workflow automations, CI/CD pipelines, and script runners.",
    skills: ["Javascript", "Python", "Docker", "GitHub Actions", "Zapier", "Bash"],
    key_projects: [
      {
        title: "Multi-channel Outreach Pipeline",
        description: "Engineered programmatic outreach workflow triggering multi-source leads.",
        impact: "Scaled lead processing by 10x with zero manual oversight."
      }
    ],
    signals: ["Obsessed with workflow optimizations", "Eliminating manual clicks"]
  }
};

export async function getProfile() {
  const SINGLETON_ID = "00000000-0000-0000-0000-000000000000";
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", SINGLETON_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      name: data.name || '',
      degree: data.degree || '',
      college: data.college || '',
      cgpa: data.cgpa || '',
      skills: data.skills || '',
      targetRole: data.target_role || '',
      linkedin: data.linkedin || '',
      github: data.github || '',
      projects: data.projects || '',
      tone: data.tone || 'confident, builder, not desperate',
      profileModes: data.profile_modes && Object.keys(data.profile_modes).length > 0 ? data.profile_modes : DEFAULT_PROFILE_MODES
    };
  } catch (err) {
    console.error("Error fetching profile from Supabase:", err);
    return null;
  }
}
