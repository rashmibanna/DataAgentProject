import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/dashboard";
import ProfilingOptions from "./pages/profiling/options";   
import Preview from "./pages/profiling/preview";
import ProfilingRules from "./pages/profiling/rules";
import GP from './pages/profiling/GoogleDrivePicker';
import HomeButton from "./pages/profiling/HomeButton";
import OptionsMapping from './pages/mapping/optionsMapping';
import DriveSelection from "./pages/mapping/DriveSelection";
import FileSelection from "./pages/mapping/FileSelection";
import FinalLink from "./pages/mapping/FinalLink";


function App() {
  return (
    <>
<Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profiling/options" element={<ProfilingOptions />} />
      <Route path="/profiling/preview" element={<Preview />} />
      <Route path="/profiling/rules" element={<ProfilingRules/>} />
      <Route path="/profiling/GoogleDrivePicker" element={<GP/>}/>
      <Route path="/mapping/OptionsMapping" element={<OptionsMapping/>} />
      <Route path="/DriveSelection" element={<DriveSelection />} />
      <Route path="/FileSelection" element={<FileSelection />} /> 
      <Route path="/FinalLink" element={<FinalLink/>} />
    </Routes>
    <HomeButton/> 
    </>

  );
}

export default App;
