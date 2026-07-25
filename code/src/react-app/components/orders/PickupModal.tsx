import { useState, useRef, useCallback } from "react";
import { Camera, X, Check, AlertTriangle, Image as ImageIcon, CheckCircle } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/react-app/components/ui/dialog";
import type { OrderWithItems } from "@/shared/types";

interface PickupModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderWithItems;
  onConfirm: (photoKey: string) => Promise<void>;
  onSuccess?: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function PickupModal({ isOpen, onClose, order, onConfirm, onSuccess }: PickupModalProps) {
  const [step, setStep] = useState<"warning" | "camera" | "preview" | "uploading" | "success">("warning");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = (order.total_amount || 0) - (order.paid_amount || 0);
  const isUnpaid = remaining > 0;

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStep("camera");
    } catch (err) {
      console.error("Camera error:", err);
      alert("Tidak bisa mengakses kamera. Silakan gunakan upload foto.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImage(dataUrl);
        stopCamera();
        setStep("preview");
      }
    }
  }, [stopCamera]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        setStep("preview");
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setStep("warning");
  }, []);

  const uploadAndConfirm = useCallback(async () => {
    if (!capturedImage) return;
    
    setStep("uploading");
    
    try {
      // Convert data URL to blob
      const res = await fetch(capturedImage);
      const blob = await res.blob();
      
      const formData = new FormData();
      formData.append("photo", blob, "pickup.jpg");
      
      const uploadRes = await fetch(`/api/uploads/pickup/${order.id}`, {
        method: "POST",
        body: formData,
      });
      
      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload foto gagal");
      }
      
      const { key } = await uploadRes.json();
      
      // Update order with pickup info
      await onConfirm(key);
      
      // Show success state
      setStep("success");
      onSuccess?.();
      
      // Auto close after showing success
      setTimeout(() => {
        stopCamera();
        setCapturedImage(null);
        setStep("warning");
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Upload error:", err);
      alert(err instanceof Error ? err.message : "Gagal menyimpan. Silakan coba lagi.");
      setStep("preview");
    }
  }, [capturedImage, order.id, onConfirm, onSuccess, stopCamera, onClose]);

  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setStep("warning");
    onClose();
  }, [stopCamera, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Konfirmasi Pengambilan</DialogTitle>
        </DialogHeader>

        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {step === "warning" && (
          <div className="space-y-4">
            {isUnpaid && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Pesanan Belum Lunas!</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Sisa pembayaran: <strong>{formatCurrency(remaining)}</strong>
                  </p>
                </div>
              </div>
            )}
            
            <p className="text-muted-foreground">
              Ambil foto sebagai bukti pengambilan pesanan oleh pelanggan.
            </p>

            <div className="flex flex-col gap-2">
              <Button onClick={startCamera} className="w-full">
                <Camera className="mr-2 h-4 w-4" />
                Buka Kamera
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Upload Foto
              </Button>
            </div>
          </div>
        )}

        {step === "camera" && (
          <div className="space-y-4">
            <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                <X className="mr-2 h-4 w-4" />
                Batal
              </Button>
              <Button onClick={capturePhoto} className="flex-1">
                <Camera className="mr-2 h-4 w-4" />
                Ambil Foto
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && capturedImage && (
          <div className="space-y-4">
            <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
              <img
                src={capturedImage}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={retakePhoto} className="flex-1">
                <Camera className="mr-2 h-4 w-4" />
                Ulangi
              </Button>
              <Button onClick={uploadAndConfirm} className="flex-1">
                <Check className="mr-2 h-4 w-4" />
                Konfirmasi
              </Button>
            </div>
          </div>
        )}

        {step === "uploading" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Mengupload foto...</p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <p className="text-lg font-medium text-green-700">Berhasil Disimpan!</p>
            <p className="text-sm text-muted-foreground">Data pengambilan sudah tersimpan</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
