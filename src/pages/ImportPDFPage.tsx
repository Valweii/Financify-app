import { PDFUploadForm } from "@/components/PDFUploadForm";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ImportPDFPage = () => {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate(-1); // Go back to previous page
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <div className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border z-40">
          <div className="px-4 py-4 flex items-center gap-3">
            <button 
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-primary">Import PDF</h1>
          </div>
        </div>
        
        <div className="px-4 py-4">
          <PDFUploadForm onClose={handleClose} />
        </div>
      </div>
    </div>
  );
};

export default ImportPDFPage;
