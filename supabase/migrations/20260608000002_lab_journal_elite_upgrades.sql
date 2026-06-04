-- Create researcher_doses table
CREATE TABLE researcher_doses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    compound_slug TEXT NOT NULL,
    dose_amount NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    dosed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for researcher_doses
ALTER TABLE researcher_doses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own doses"
    ON researcher_doses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own doses"
    ON researcher_doses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own doses"
    ON researcher_doses FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own doses"
    ON researcher_doses FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX idx_researcher_doses_user_id ON researcher_doses(user_id);
CREATE INDEX idx_researcher_doses_dosed_at ON researcher_doses(dosed_at);

-- Create researcher_biometrics table
CREATE TABLE researcher_biometrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL, -- e.g., 'Weight', 'Pain Level', 'Sleep Quality'
    metric_value NUMERIC NOT NULL,
    unit TEXT, -- e.g., 'lbs', '/10', 'hrs'
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for researcher_biometrics
ALTER TABLE researcher_biometrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own biometrics"
    ON researcher_biometrics FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own biometrics"
    ON researcher_biometrics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own biometrics"
    ON researcher_biometrics FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX idx_researcher_biometrics_user_id ON researcher_biometrics(user_id);
CREATE INDEX idx_researcher_biometrics_measured_at ON researcher_biometrics(measured_at);
